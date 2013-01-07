
# CardKit

## 如何开始开发

### 安装

1. `npm install`

   grunt-contrib-compass有一个bug，fix方法：将node\_modules/grunt-contrib-compass/tasks/compass.js中的38行改为 `var options = this.data.options;`

2. 安装以下compass插件:

        gem install animation --pre
        gem install animate-sass
3. `cp grunt.js.tmpl grunt.js`
4. 按照grunt.js内的TODO，编辑它
5. `grunt`, 测试默认任务，编译dist和static文件
6. `grunt watch`

### 仓库

[shire-for-mobile](http://code.dapps.douban.com/shire_for_mobile)，像shire一样进行配置，推荐[vagrant](http://dou.bz/siv)。

切换到mobileapp分支，进行日常开发。master仅用作和[shire](http://svn.douban.com/svn/shire)进行同步。

以下是仓库分支之间的关系，按箭头方向做单向同步：

* `^/trunk` 
* -> `shire_for_mobile:master`（会定期与trunk同步，只做git svn rebase，不允许本地修改和push）
* -> `shire_for_mobile:mobileapp`（用于开发、本地调试和协作，只接受这个分支的pull request） 
* -> `shire_for_mobile:pre`（用于每日构建，只做git svn dcommit，dcommit前后需做git pull和push）
* -> `^/branches/lifei/cardkit` （在fili上checkout出来用于预发布/线上数据测试）

#### 如何将shire\_for\_mobile与svn仓库关联起来

    git svn init http://svn.douban.com/svn/shire -T trunk -b /branches/your_svn_name
    cp .git/refs/heads/master .git/refs/remotes/trunk

##### master分支 (同步trunk)

    git svn fetch
    git svn rebase

##### pre分支 (每日构建)

1. 在.git/config里添加remote：

        [svn-remote "lifei"]
           url = http://svn.douban.com/svn/shire
           branches = branches/lifei/*:refs/remotes/lifei/*
2. `git svn fetch -R lifei -r "/branches/lifei/cardkit/上最新revision号"` 这一步会耗费很长时间。
   完成后，`git branch -a`会看到`remotes/lifei/cardkit`
3. `git checkout -b pre lifei/cardkit` 建立pre分支，与lifei/cardkit关联

pre分支是一个本地分支，负责将mobileapp今日的更新merge进`^/branches/lifei/cardkit`内。不用和[shire\_for\_mobile](http://code/shire_for_mobile)合并。
注意：mobileapp -> pre -> ^/branches/lifei/cardkit的过程同一时间只能有一个人做，否则^/branches/lifei/cardkit上的提交记录会乱掉。
