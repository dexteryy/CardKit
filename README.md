
# CardKit

## 如何开始开发

### 安装
1. node, npm
2. ruby gem: sass, animate-sass, compass

### 仓库
[shire-for-mobile](http://code.dapps.douban.com/shire_for_mobile)，像shire一样进行配置，推荐[vagrant](http://dou.bz/siv)
切换到mobileapp分支，进行日常开发。master仅用作和[shire](http://svn.douban.com/svn/shire)进行同步。

### 准备工作
1. `npm install`
   grunt-contrib-compass有点bug，fix方法：将node_modules/grunt-contrib-compass/tasks/compass.js中的38行改为 `var options = this.data.options;`
2. `cp grunt.js.tmpl grunt.js`
3. 按照grunt.js内的TODO，编辑它
4. `grunt`, 执行默认任务，编译dist和static文件
