
module.exports = function(grunt) {

    grunt.initConfig({
        pkg: '<json:package.json>',
        meta: {
            distDir: 'dist',
            staticDir: 'static'
        },
        oz: {
        
        },
        ozma: {
            main: {
                src: 'js/main.js',
                config: {
                    baseUrl: "js/mod/",
                    distUrl: "<%= meta.distDir %>/js/mod/",
                    loader: "../lib/oz.js",
                    disableAutoSuffix: true
                },
                saveConfig: true
            }
        },
        //sass: {
            //main: {
                //options: {
                    //style: 'expanded'
                //},
                //files: {
                    //'<%= meta.distDir %>/css/main.css': 'css/main.scss'
                //}
            //}
        //},
        compass: {
            main: {
                src: 'css',
                dest: 'dist/css',
                images: 'pics',
                relativeassets: true,
                outputstyle: 'expanded',
                linecomments: false,
                //debugsass: true,
                config: 'css/config.rb',
                require: [
                    'animate-sass'
                ]
            }
        },
        //copy: {
            //dist: {
                //files: {
                    //"pics/*": "dist/pics/*"
                //}
            //}
        //},
        concat: {
            js_main: {
                src: ['<%= meta.distDir %>/js/main.js'],
                dest: '<%= meta.staticDir %>/js/<%= pkg.title %>.js'
            },
            css_main: {
                src: ['<%= meta.distDir %>/css/main.css'],
                dest: '<%= meta.staticDir %>/css/<%= pkg.title %>.css'
            }
        },
        min: {
            main: {
                src: ['<config:concat.js_main.dest>'],
                dest: '<%= meta.staticDir %>/js/<%= pkg.title %>.min.js'
            }
        },
        cssmin: {
            main: {
                src: ['<config:concat.css_main.dest>'],
                dest: '<%= meta.staticDir %>/css/<%= pkg.title %>.min.css'
            }
        },
        lint: {
            files: ['grunt.js', '<%= meta.distDir %>/**/*.js']
        },
        //csslint: {
            //main: {
                //src: "<config:concat.css.src>",
                //rules: {
                    //"import": false,
                    //"overqualified-elements": 2
                //}
            //}
        //},
        watch: [{
            files: 'js/**/*.js',
            tasks: 'ozma'
        }, {
            files: 'css/**/*.scss',
            tasks: 'compass'
        }],
        jshint: {},
        uglify: {}
    });

    grunt.loadNpmTasks('grunt-ozjs');
    //grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-compass');
    grunt.loadNpmTasks('grunt-css');
    //grunt.loadNpmTasks('grunt-contrib-copy');
    //grunt.loadNpmTasks('grunt-contrib-watch');
    
    grunt.registerTask('default', 'ozma:main compass:main concat min cssmin');

};
