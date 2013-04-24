
module.exports = function(grunt) {

    var config = require('./config');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        meta: {
            targetDir: 'target',
            distDir: 'dist',
            examplesDir: 'examples',
            jsPublicDir: config.jsPublicDir + '/<%= pkg.name %>',
            cssPublicDir: config.cssPublicDir + '/<%= pkg.name %>',
            picsPublicDir: config.picsPublicDir + '/<%= pkg.name %>'
        },

        clean: {
            test: ["<%= meta.examplesDir %>/dist"],
            target: ["<%= meta.targetDir %>"],
            dist: ["<%= meta.distDir %>"]
        },

        furnace: {
            tpl: {
                options: {
                    importas: 'tpl',
                    exportas: 'amd'
                },
                files: [{
                    expand: true,     // Enable dynamic expansion.
                    cwd: 'tpl/',
                    src: ['**/*.tpl'], // Actual pattern(s) to match.
                    dest: 'js/<%= pkg.name %>/tpl/',   // Destination path prefix.
                    ext: '.js'
                }]
            }
        },

        ozma: {
            main: {
                saveConfig: true,
                src: 'js/main.js',
                config: {
                    baseUrl: "js/mod/",
                    distUrl: "<%= meta.targetDir %>/js/mod/",
                    loader: "../lib/oz.js",
                    disableAutoSuffix: true
                }
            },
            browsers: {
                src: 'examples/js/browsers_test.js',
                config: {
                    baseUrl: "js/mod/",
                    loader: "../lib/oz.js"
                }
            }
        },

        compass: {
            main: {
                options: {
                    config: 'css/config.rb',
                    sassDir: 'css',
                    cssDir: '<%= meta.targetDir %>/css',
                    imagesDir: '<%= meta.targetDir %>/pics',
                    relativeAssets: true,
                    outputStyle: 'expanded',
                    noLineComments: false,
                    require: [
                        'compass-normalize',
                        'animation',
                        'animate-sass',
                        'ceaser-easing',
                        'compass-recipes'
                    ],
                    environment: 'production'
                }
            }
        },

        imagemin: {
            main: {
                options: {
                    optimizationLevel: 3
                },
                files: {
                    '<%= meta.targetDir %>/pics/': 'pics/**/*.{png,jpg}'
                }
            }
        },

        concat: {
            options: {
                stripBanners: true,
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> */\n'
            },
            js: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.targetDir %>/js/',
                    src: ['**/*.js'],
                    dest: '<%= meta.distDir %>/js/'
                }]
            },
            css: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.targetDir %>/css/',
                    src: ['**/*.css'],
                    dest: '<%= meta.distDir %>/css/'
                }]
            }
        },

        uglify: {
            main: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/js/',
                    src: ['**/*.js'],
                    dest: '<%= meta.distDir %>/js/',
                    ext: '.min.js'
                }]
            }
        },

        cssmin: {
            main: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/css/',
                    src: ['**/*.css'],
                    dest: '<%= meta.distDir %>/css/',
                    ext: '.min.css'
                }]
            }
        },

        copy: {
            target2examples: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.targetDir %>/',
                    src: ['**', '!pics/**'],
                    dest: '<%= meta.examplesDir %>/dist/'
                }]
            },
            dist2examples: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/',
                    src: ['**'],
                    dest: '<%= meta.examplesDir %>/dist/'
                }]
            },
            target2pub: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.targetDir %>/js/',
                    src: ['**', '!pics/**'],
                    dest: '<%= meta.jsPublicDir %>/'
                }, {
                    expand: true,
                    cwd: '<%= meta.targetDir %>/css/',
                    src: ['**', '!pics/**'],
                    dest: '<%= meta.cssPublicDir %>/'
                }]
            },
            dist2pub: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/js/',
                    src: ['**'],
                    dest: '<%= meta.jsPublicDir %>/'
                }, {
                    expand: true,
                    cwd: '<%= meta.distDir %>/css/',
                    src: ['**'],
                    dest: '<%= meta.cssPublicDir %>/'
                }]
            }
        },

        jshint: {
            options: grunt.file.readJSON('jshint.json'),
            dev: {
                options: {
                    devel: true,
                    debug: true,
                    asi: true 
                },
                files: {
                    src: ['./*.js', 'js/**/*.js', '!js/mod/**']
                }
            },
            dist: {
                files: {
                    src: ['./*.js', 'js/**/*.js', '!js/mod/**']
                }
            }
        },

        complexity: {
            generic: {
                src: ['js/cardkit/**/*.js', '!js/cardkit/tpl/**'],
                options: {
                    cyclomatic: 10,
                    halstead: 25,
                    maintainability: 100
                }
            }
        },

        connect: {
            examples: {
                options: {
                    hostname: 'ck.douban.com',
                    port: 9001,
                    base: 'examples/',
                    keepalive: true
                }
            }
        },

        watch: {
            dev: {
                files: [
                    'tpl/**/*.tpl', 
                    'pics/**/*.{png,jpg}', 
                    'js/**/*.js', 
                    'examples/js/**/*.js', 
                    'css/**/*.scss'
                ],
                tasks: [
                    'dev', 
                    'devtest'
                ]
            },
            pub: {
                files: [
                    'tpl/**/*.tpl', 
                    'pics/**/*.{png,jpg}', 
                    'js/**/*.js', 
                    'examples/js/**/*.js', 
                    'css/**/*.scss'
                ],
                tasks: [
                    'dev', 
                    'devtest',
                    'copy:target2pub'
                ]
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-imagemin');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-compass');
    grunt.loadNpmTasks('grunt-contrib-livereload');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-complexity');

    grunt.loadNpmTasks('grunt-furnace');
    grunt.loadNpmTasks('grunt-ozjs');
    
    grunt.registerTask('dev', [
        'clean:target', 
        'clean:test', 
        'furnace:tpl', 
        'imagemin', 
        'ozma', 
        'compass'
    ]);

    grunt.registerTask('devtest', [
        'clean:test',
        'copy:target2examples'
    ]);

    grunt.registerTask('publish', [
        'clean:dist',
        'concat',
        'uglify', 
        'cssmin'
    ]);

    grunt.registerTask('test', [
        'clean:test',
        'copy:dist2examples'
    ]);

    grunt.registerTask('deploy', [
        'copy:dist2pub'
    ]);

    grunt.registerTask('default', [
        'jshint:dist',
        'dev',
        'publish',
        'test'
    ]);

};
