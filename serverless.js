const COS = require('cos-nodejs-sdk-v5')
const path = require('path')
const util = require('util')
const fs = require('fs')
const exec = util.promisify(require('child_process').exec)
const { Component, utils } = require('@serverless/core')
const { configureBucketForHosting } = require('./utils')
const tencentAuth = require('serverless-tencent-auth-tool')

class Website extends Component {
  confirmEnding(sourceStr, targetStr) {
    // judge the sourceStr end with targetStr
    targetStr = targetStr.toString()
    const start = sourceStr.length - targetStr.length
    const arr = sourceStr.substr(start, targetStr.length)
    if (arr == targetStr) {
      return true
    }
    return false
  }

  async default(inputs = {}) {
    // login
    const auth = new tencentAuth()
    this.context.credentials.tencent = await auth.doAuth(this.context.credentials.tencent, {
      client: 'tencent-website',
      remark: inputs.fromClientRemark,
      project: this.context.instance ? this.context.instance.id : undefined,
      action: 'default'
    })

    // const option = {
    //   region: inputs.region || 'ap-guangzhou',
    //   timestamp: this.context.credentials.tencent.timestamp || null,
    //   token: this.context.credentials.tencent.token || null
    // }

    // Default to current working directory
    inputs.code = inputs.code || {}
    inputs.code.root = inputs.code.root ? path.resolve(inputs.code.root) : process.cwd()
    inputs.code.index = inputs.code.index || 'index.html'
    inputs.code.error = inputs.code.error || 'error.html'
    if (inputs.code.src) {
      inputs.code.src = path.join(inputs.code.root, inputs.code.src)
    }
    if (inputs.code.envPath) {
      inputs.code.envPath = path.join(inputs.code.root, inputs.code.envPath)
    }
    inputs.region = inputs.region || 'ap-guangzhou'
    inputs.bucketName = this.state.bucketName || inputs.bucketName || this.context.resourceId()
    if (!this.confirmEnding(inputs.bucketName, this.context.credentials.tencent.AppId)) {
      inputs.bucketName = inputs.bucketName + '-' + this.context.credentials.tencent.AppId
    }

    this.context.status(`Preparing Tencent COS Bucket`)
    this.context.debug(`Preparing website Tencent COS bucket ${inputs.bucketName}.`)

    const websiteBucket = await this.load('@serverless/tencent-cos', 'websiteBucket')
    await websiteBucket({
      bucket: inputs.bucketName,
      region: inputs.region,
      fromClientRemark: inputs.fromClientRemark || 'tencent-website'
    })
    this.state.bucketName = inputs.bucketName
    await this.save()

    const tencentConf = this.context.credentials.tencent
    const cos = new COS({
      SecretId: tencentConf.SecretId,
      SecretKey: tencentConf.SecretKey,
      TmpSecretId: tencentConf.SecretId,
      TmpSecretKey: tencentConf.SecretKey,
      XCosSecurityToken: tencentConf.token,
      ExpiredTime: tencentConf.timestamp,
      UserAgent: 'ServerlessComponent'
    })

    inputs.protocol = inputs.protocol || 'http'
    this.context.debug(`Configuring bucket ${inputs.bucketName} for website hosting.`)
    await configureBucketForHosting(
      cos,
      inputs.bucketName,
      this.context.credentials.tencent.AppId,
      inputs.region,
      inputs.code.index,
      inputs.code.error,
      inputs.cors || null,
      inputs.protocol
    )

    // Build environment variables
    const envPath = inputs.code.envPath || inputs.code.root
    if (inputs.env && Object.keys(inputs.env).length && envPath) {
      this.context.status(`Bundling environment variables`)
      this.context.debug(`Bundling website environment variables.`)
      let script = 'window.env = {};\n'
      inputs.env = inputs.env || {}
      for (const e in inputs.env) {
        // eslint-disable-line
        script += `window.env.${e} = ${JSON.stringify(inputs.env[e])};\n` // eslint-disable-line
      }
      const envFilePath = path.join(envPath, 'env.js')
      await utils.writeFile(envFilePath, script)
      this.context.debug(`Website env written to file ${envFilePath}.`)
    }

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      this.context.status('Building assets')
      this.context.debug(`Running ${inputs.code.hook} in ${inputs.code.root}.`)

      const options = { cwd: inputs.code.root }
      try {
        await exec(inputs.code.hook, options)
      } catch (err) {
        console.error(err.stderr) // eslint-disable-line
        throw new Error(
          `Failed building website via "${inputs.code.hook}" due to the following error: "${err.stderr}"`
        )
      }
    }

    this.context.status('Uploading')

    const dirToUploadPath = inputs.code.src || inputs.code.root

    this.context.debug(
      `Uploading website files from ${dirToUploadPath} to bucket ${inputs.bucketName}.`
    )

    const uploadDict = {
      fromClientRemark: inputs.fromClientRemark || 'tencent-website'
    }
    if (fs.lstatSync(dirToUploadPath).isDirectory()) {
      uploadDict.dir = dirToUploadPath
    } else {
      uploadDict.file = dirToUploadPath
    }

    if (uploadDict.dir) {
      // 控制旧版本数量
      const keepVersion = inputs.keepVersion || 2
      const dir = fs.readdirSync(dirToUploadPath)[0]
      const match = dir ? dir.match(/(.+?)[\d\-_.|:]+$/) : null
      const prefix = match ? match[1] : null
      if (prefix) {
        let handler
        let oldVers = []
        // 查找旧版本
        try {
          handler = util.promisify(cos.getBucket.bind(cos))
          const res = await handler({
            Bucket: inputs.bucketName,
            Region: inputs.region,
            Prefix: prefix
          })
          oldVers = res.Contents
        } catch (e) {
          throw e
        }
        // 删除旧版本
        if (oldVers.length > keepVersion) {
          handler = util.promisify(cos.deleteObject.bind(cos))
          const arr = oldVers
            .sort((fst, snd) => {
              return new Date(fst.LastModified) - new Date(snd.LastModified)
            })
            .slice(0, oldVers.length - keepVersion)
          for (const oldVer of arr) {
            await handler({
              Bucket: inputs.bucketName,
              Region: inputs.region,
              Key: oldVer.Key
            })
          }
        }
      }
    }

    await websiteBucket.upload(uploadDict)
    const cosOriginAdd = `${inputs.bucketName}.cos-website.${inputs.region}.myqcloud.com`

    // add user domain
    if (inputs.hosts && inputs.hosts.length > 0) {
      let tencentCdn
      let tencentCdnOutput
      let cdnInputs
      this.state.host = new Array()
      this.state.hostName = new Array()
      for (let i = 0; i < inputs.hosts.length; i++) {
        cdnInputs = inputs.hosts[i]
        cdnInputs.hostType = 'cos'
        cdnInputs.serviceType = 'web'
        cdnInputs.fwdHost = cosOriginAdd
        cdnInputs.origin = cosOriginAdd
        tencentCdn = await this.load(
          '@serverless/tencent-cdn',
          inputs.hosts[i].host.replace('.', '_')
        )
        cdnInputs.fromClientRemark = inputs.fromClientRemark || 'tencent-website'
        tencentCdnOutput = await tencentCdn(cdnInputs)
        const protocol = tencentCdnOutput.https ? 'https' : 'http'
        this.state.host.push(
          protocol + '://' + tencentCdnOutput.host + ' (CNAME: ' + tencentCdnOutput.cname + '）'
        )
        this.state.hostName.push(inputs.hosts[i].host.replace('.', '_'))
      }
    }

    this.state.bucketName = inputs.bucketName
    this.state.region = inputs.region
    this.state.url = `${inputs.protocol}://${cosOriginAdd}`
    await this.save()

    const outputs = {
      url: this.state.url,
      env: inputs.env || {}
    }

    if (this.state.host) {
      outputs.host = this.state.host
    }

    this.context.debug(`Website deployed successfully to URL: ${this.state.url}.`)

    return outputs
  }

  /**
   * Remove
   */

  async remove(inputs = {}) {
    this.context.status(`Removing`)

    this.context.debug(`Starting Website Removal.`)

    this.context.debug(`Removing Website bucket.`)

    const removeInput = {
      fromClientRemark: inputs.fromClientRemark || 'tencent-website'
    }

    const websiteBucket = await this.load('@serverless/tencent-cos', 'websiteBucket')
    await websiteBucket.remove(removeInput)

    if (this.state.hostName && this.state.hostName.length > 0) {
      let tencentCdn
      for (let i = 0; i < this.state.hostName.length; i++) {
        tencentCdn = await this.load('@serverless/tencent-cdn', this.state.hostName[i])
        await tencentCdn.remove(removeInput)
      }
    }

    this.state = {}
    await this.save()

    this.context.debug(`Finished Website Removal.`)
    return {}
  }
}

module.exports = Website
