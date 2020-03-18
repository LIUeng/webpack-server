<h1 align="center">如何实现一个简易热更新</h1>

使用 Webpack + Nodejs(Express) 实现热更新

[项目地址](https://github.com/LIUeng/webpack-server)

## 实现思考？

保存代码，webpack 监听编译代码，编译完成，通知浏览器更新页面（抛出想法，解决问题）

### 思考一

***项目利用 Nodejs(Http) + Express 启动一个端口服务作为服务端***

#### `解答`

```js

// 项目目录 servers/Server.js
// 启动端口
let app = new express();
let server = http.createServer(app);
server.listen(port, hostname, (err) => {})

```

### 思考二

webpack 监听文件变化以及编译

#### `解答`

```js

// 项目目录 servers/Server.js
// 这里 express 借助 webpack-dev-middware 中间件
let app = new express();
let middleware = webpackDevMiddleware(compiler, {
    logLevel: 'error', // 编译出错时打印日志 log
});
app.use(middleware);

```

* webpack-dev-middware 中间件作用

- 启动 webpack compiler watch [监听入口文件的变化 实时编译]
    
    ```js
    let compiler = webpack(config);
    compiler.watch({}, (err, stats) => {});
    ```

- 作为 express 的中间件

    - webpack-dev-middleware 利用 memory-fs 进行文件的记忆性生成 [实际上已经生成,没看到而已,可以配置writeToDisk] main.js

    - 访问 http://localhost:xxxx 时获取资源文件 [webpack=>output=>filename] main.js

- 配合 html-webpack-plugin 插件

    - /public/index.html 模板文件 -> 生成访问的html文件

    ```html
    <body>
        <div id="app"></div>
        <script src="main.js"></script>
    </body>
    ```

### 思考三

实现双方通信 websocket [浏览器端][服务端]

#### `解答`

[参考 sockjs-client](https://github.com/sockjs/sockjs-client)

[参考 sockjs-node](https://github.com/sockjs/sockjs-node)

- 浏览器端(利用 sockjs-client 创建 websocket)

    ```js

    // 参考目录 clients/index.js
    // url: http://localhost:xxxx
    let clients = new SockJsClient(url);

    // events: onopen onclose onmessage

    ```

- 服务端(利用 sockjs-node 创建 socket 服务)

    ```js

    // 参考目录 servers/Server.js
    // createSocketServer
    let socketServer = new sockjs();
    socketServer.createServer({});
    socketServer.installHandlers(app, {
        prefix: '/xxxx', // 这里是你要创建的 socket 服务地址
    });

    // events: send onconnection onclose

    ```

- 如何通信并刷新浏览器

    利用 webpack hooks 监听文件编译完成

    - ⚔ 服务端

    ```js
    compiler.hooks.done.tap('dev-server', function() {
        // 这里通过服务端 socket server 发送一组信号 通知浏览器端 onmessage
    })
    ```

    - ⚔ 浏览器端

        - 这里需要把浏览器端需要创建的 websocket 代码引入到 index.html 中

        - 所以这里我们把 clients/index.js 和 项目入口 ./src/index.js 共同加入到 webpack 的 entry 中

        - 一起打包到 webpack output 文件中

        - 参考文件 webpack.config.js

    - ⚔ 刷新页面

        - socekt server 发送信号 浏览器已经创建了 websocket 建立连接
    
        - 收到信号 浏览器利用自身的 `window` 对象进行刷新 window.location.reload()

    - ⚔ 结束

        - 完成一次通信


## 环境准备

安装所需要的依赖包

- webpack
- html-webpack-plugin
- sockjs
- sockjs-client
- express

## 目录搭建

- clients 客户端
- public 模板html
- servers 服务端
- src 页面目录
- scripts 启动项目脚本目录

## 项目启动

```bash
npm run start

or

yarn start
```

