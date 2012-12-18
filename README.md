
# CardKit


## 如何开始开发

1. 安装node, npm, sass, animate-sass, compass
2. 执行`npm install`（安装开发环境需要的工具）
    1. grunt-contrib-compass有点bug，fix方法：将node_modules/grunt-contrib-compass/tasks/compass.js中的38行改为 `var options = this.data.options;`
3. 执行`grunt istatic`（获取项目依赖的前端代码）
4. 编辑grunt.js中的`meta.jsServeDir`、`meta.cssServeDir`，修改为本地shire仓库的路径
5. 执行`grunt`，检查dist文件和static文件是否能正常编译
6. 执行`grunt watch`，进入开发
