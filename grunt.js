
module.exports = function(grunt) {

    grunt.initConfig({
        pkg: '<json:package.json>',
        meta: {
            distDir: 'dist',
            staticDir: 'static',
            jsServeDir: '/Users/dexteryy/code/douban/vagrant/shire-git/static/js/cardkit',
            cssServeDir: '/Users/dexteryy/code/douban/vagrant/shire-git/static/css/cardkit',
            picsServeDir: '/Users/dexteryy/code/douban/vagrant/shire-git/pics/cardkit'
        },
        istatic: {
            main: {
                repos: {
                    'dexteryy/OzJS': {
                        file: {
                            '/oz.js': '/js/lib/'
                        }
                    },
                    'dexteryy/mo': {
                        file: {
                            '/lang.js': '/js/mod/mo/',
                            '/domready.js': '/js/mod/mo/',
                            '/browsers.js': '/js/mod/mo/',
                            '/cookie.js': '/js/mod/mo/',
                            '/network.js': '/js/mod/mo/',
                            '/template.js': '/js/mod/mo/'
                        }
                    },
                    'dexteryy/DollarJS': {
                        file: {
                            '/dollar.js': '/js/mod/'
                        }
                    },
                    'dexteryy/EventMaster': {
                        file: {
                            '/eventmaster.js': '/js/mod/'
                        }
                    },
                    'dexteryy/ChoreoJS': {
                        file: {
                            '/choreo.js': '/js/mod/'
                        }
                    }
                }
            }
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
        compass: {
            main: {
                options: {
                    config: 'css/config.rb',
                    sassDir: 'css',
                    cssDir: 'dist/css',
                    imagesDir: 'pics',
                    relativeAssets: true,
                    outputStyle: 'expanded',
                    noLineComments: false,
                    require: [
                        'animate-sass'
                    ],
                    environment: 'production'
                }
                //src: 'css',
                //dest: 'dist/css',
                //images: 'pics',
                //relativeassets: true,
                //outputstyle: 'expanded',
                //linecomments: false,
                ////debugsass: true,
                //config: 'css/config.rb',
                //require: [
                    //'animate-sass'
                //]
            }
        },
        concat: {
            js_main: {
                src: ['<%= meta.distDir %>/js/main.js'],
                dest: '<%= meta.staticDir %>/js/main.src.js'
            },
            css_main: {
                src: ['<%= meta.distDir %>/css/main.css'],
                dest: '<%= meta.staticDir %>/css/main.src.css'
            }
        },
        min: {
            main: {
                src: ['<config:concat.js_main.dest>'],
                dest: '<%= meta.staticDir %>/js/main.js'
            }
        },
        cssmin: {
            main: {
                src: ['<config:concat.css_main.dest>'],
                dest: '<%= meta.staticDir %>/css/main.css'
            }
        },
        copy: {
            dist2serve: {
                files: {
                    "<%= meta.jsServeDir %>/": ["<%= meta.distDir %>/js/**"],
                    "<%= meta.cssServeDir %>/": ["<%= meta.distDir %>/css/**"]
                    //"<%= meta.picsServeDir %>/": ["<%= meta.distDir %>/pics/**"]
                }
            },
            static2serve: {
                files: {
                    "<%= meta.jsServeDir %>/": ["<%= meta.staticDir %>/js/**"],
                    "<%= meta.cssServeDir %>/": ["<%= meta.staticDir %>/css/**"]
                    //"<%= meta.picsServeDir %>/": ["<%= meta.staticDir %>/pics/**"]
                }
            }
        },
        lint: {
            files: ['grunt.js', '<%= meta.distDir %>/**/*.js']
        },
        watch: [{
            files: 'js/**/*.js',
            tasks: 'ozma copy:dist2serve'
        }, {
            files: 'css/**/*.scss',
            tasks: 'compass copy:dist2serve'
        }],
        jshint: {},
        uglify: {}
    });

    grunt.loadNpmTasks('grunt-istatic');
    grunt.loadNpmTasks('grunt-ozjs');
    grunt.loadNpmTasks('grunt-contrib-compass');
    grunt.loadNpmTasks('grunt-css');
    grunt.loadNpmTasks('grunt-contrib-copy');
    
    grunt.registerTask('default', [
        'ozma:main', 
        'compass:main',
        'concat',
        'min', 
        'cssmin', 
        'copy:static2serve'
    ]);

};
