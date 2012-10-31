
module.exports = function(grunt) {

    grunt.initConfig({
        pkg: '<%= grunt.file.readJSON("package.json") %>',
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
                    baseUrl: "js/",
                    distUrl: "<%= meta.distDir %>/js/",
                    loader: "lib/oz.js",
                    disableAutoSuffix: true
                },
                save_config: true,
                debounceDelay: 3000
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
                linecomments: true,
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
        watch: {
            files: ['js/**/*.js', 'css/**/*.scss'],
            tasks: ['ozma:main', 'compass:main']
        },
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
