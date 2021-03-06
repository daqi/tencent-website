[![Serverless Framework Tencent Cloud Plugin](https://img.serverlesscloud.cn/202019/1578569597879-website.png)](http://serverless.com)

&nbsp;

- [请点击这里查看英文版部署文档](./README_EN.md)

&nbsp;

# 腾讯云静态网站组件

## 简介

静态网站应用调用了基础的腾讯云 COS 组件，可以快速部署静态网站页面到对象存储 COS 中，并生成域名供访问。

## 快速开始

操作步骤如下：

1. [安装](#1-安装)
2. [创建](#2-创建)
3. [配置](#3-配置)
4. [部署](#4-部署)
5. [移除](#5-移除)

&nbsp;

### 1. 安装

通过 npm 安装 serverless

```console
$ npm install -g serverless
```

### 2. 创建

本地创建 my-website 文件夹

```console
$ mkdir my-website
$ cd my-website
```

在文件夹中创建对应的 `serverless.yml` 文件，并将静态页面放在`code`目录下，文件目录结构如下：

```console
$ touch serverless.yml
```

```
|- code
  |- index.html
|- serverless.yml

```

`code`目录下应该对应 HTML/CSS/JS 资源的文件，或者一个完整的 React 应用。
下载 [示例 HTML](https://tinatest-1251971143.cos.ap-beijing.myqcloud.com/index.html)，将以下代码放在 index.html 文件中：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Hello, Tencent Cloud</title>
  </head>
  <body>
    Hello, Tencent Cloud
  </body>
</html>
```

### 3. 配置

在 `serverless.yml` 文件中进行如下配置

```yml
# serverless.yml

myWebsite:
  component: '@serverless/tencent-website'
  inputs:
    code:
      src: ./code
      index: index.html
      error: index.html
    region: ap-guangzhou
    bucketName: my-bucket
```

- [点击此处查看配置文档](https://github.com/serverless-tencent/tencent-website/blob/master/docs/configure.md)

### 4. 部署

如您的账号未[登陆](https://cloud.tencent.com/login)或[注册](https://cloud.tencent.com/register)腾讯云，您可以直接通过`微信`扫描命令行中的二维码进行授权登陆和注册。

通过`sls`命令进行部署，并可以添加`--debug`参数查看部署过程中的信息

```console
$ sls --debug

    DEBUG ─ Resolving the template's static variables.
    DEBUG ─ Collecting components from the template.
    DEBUG ─ Downloading any NPM components found in the template.
    DEBUG ─ Analyzing the template's components dependencies.
    DEBUG ─ Creating the template's components graph.
    DEBUG ─ Syncing template state.
    DEBUG ─ Executing the template's components graph.
    DEBUG ─ Starting Website Component.
    DEBUG ─ Preparing website Tencent COS bucket my-bucket-1300415943.
    DEBUG ─ Deploying "my-bucket-1300415943" bucket in the "ap-guangzhou" region.
    DEBUG ─ "my-bucket-1300415943" bucket was successfully deployed to the "ap-guangzhou" region.
    DEBUG ─ Setting ACL for "my-bucket-1300415943" bucket in the "ap-guangzhou" region.
    DEBUG ─ Ensuring no CORS are set for "my-bucket-1300415943" bucket in the "ap-guangzhou" region.
    DEBUG ─ Ensuring no Tags are set for "my-bucket-1300415943" bucket in the "ap-guangzhou" region.
    DEBUG ─ Configuring bucket my-bucket-1300415943 for website hosting.
    DEBUG ─ Uploading website files from /Users/dfounderliu/Desktop/temp/code/src to bucket my-bucket-1300415943.
    DEBUG ─ Starting upload to bucket my-bucket-1300415943 in region ap-guangzhou
    DEBUG ─ Uploading directory /Users/dfounderliu/Desktop/temp/code/src to bucket my-bucket-1300415943
    DEBUG ─ Website deployed successfully to URL: https://my-bucket-1300415943.cos-website.ap-guangzhou.myqcloud.com.

    myWebsite:
      url: https://my-bucket-1300415943.cos-website.ap-guangzhou.myqcloud.com
      env:

    2s › myWebsite › done

```

### 5. 移除

通过以下命令移除项目

```console
sls remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Starting Website Removal.
  DEBUG ─ Removing Website bucket.
  DEBUG ─ Removing files from the "my-bucket-1300415943" bucket.
  DEBUG ─ Removing "my-bucket-1300415943" bucket from the "ap-guangzhou" region.
  DEBUG ─ "my-bucket-1300415943" bucket was successfully removed from the "ap-guangzhou" region.
  DEBUG ─ Finished Website Removal.

  3s › myWebsite › done
```

### 账号配置（可选）

当前默认支持 CLI 扫描二维码登录，如您希望配置持久的环境变量/秘钥信息，也可以本地创建 `.env` 文件

```console
$ touch .env # 腾讯云的配置信息
```

在 `.env` 文件中配置腾讯云的 SecretId 和 SecretKey 信息并保存

如果没有腾讯云账号，可以在此[注册新账号](https://cloud.tencent.com/register)。

如果已有腾讯云账号，可以在[API 密钥管理](https://console.cloud.tencent.com/cam/capi)中获取 `SecretId` 和`SecretKey`.

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
```

### 还支持哪些组件？

可以在 [Serverless Components](https://github.com/serverless/components) repo 中查询更多组件的信息。
