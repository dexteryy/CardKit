
module.exports = function(grunt) {

    var config = require('./config');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        meta: {
            targetDir: 'target',
            distDir: '.dist',
            releaseDir: 'dist',
            examplesDir: 'examples',
            jstplDir: "js/<%= pkg.name %>/tpl",
            jsComponentDir: "js/component",
            jsPublicDir: config.jsPublicDir + '/<%= pkg.name %>',
            cssPublicDir: config.cssPublicDir + '/<%= pkg.name %>'
        },

        clean: {
            jstpl: ["<%= meta.jstplDir %>/"],
            jsComponent: ["<%= meta.jsComponentDir %>/"],
            cssMoui: ["css/moui/"],
            examples_dist: ["<%= meta.examplesDir %>/dist/js", "<%= meta.examplesDir %>/dist/css"],
            target_js: ["<%= meta.targetDir %>/js"],
            target_css: ["<%= meta.targetDir %>/css"],
            target_pics: ["<%= meta.targetDir %>/pics"],
            release: ["<%= meta.releaseDir %>"],
            dist: ["<%= meta.distDir %>"]
        },

        dispatch: {
            options: {
                directory: "bower_components"
            },
            "ozjs": {
                use: {
                    "<%= meta.jsComponentDir %>/": "oz.js"
                }
            },
            "mo": {
                use: {
                    "<%= meta.jsComponentDir %>/mo/": ["**/*.js", "!**/Gruntfile.js"]
                }
            },
            "eventmaster": {
                use: {
                    "<%= meta.jsComponentDir %>/": "eventmaster.js"
                }
            },
            "dollar": {
                use: {
                    "<%= meta.jsComponentDir %>/": ["**/*.js", "!**/Gruntfile.js"]
                }
            },
            "soviet": {
                use: {
                    "<%= meta.jsComponentDir %>/": "soviet.js"
                }
            },
            "choreo": {
                use: {
                    "<%= meta.jsComponentDir %>/": "choreo.js"
                }
            },
            "momo": {
                use: {
                    "<%= meta.jsComponentDir %>/": ["**/*.js", "!**/Gruntfile.js"]
                }
            },
            "moui": {
                use: [{
                    cwd: "css/moui",
                    src: ["**"],
                    dest: "css/moui/"
                }, {
                    src: ["**/*.js", "!**/Gruntfile.js"],
                    dest: "<%= meta.jsComponentDir %>/moui/"
                }]
            }
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
                    dest: '<%= meta.jstplDir %>/',   // Destination path prefix.
                    ext: '.js'
                }]
            }
        },

        ozma: {
            main: {
                saveConfig: false,
                src: 'js/main.js',
                config: {
                    baseUrl: "<%= meta.jsComponentDir %>/",
                    distUrl: "<%= meta.targetDir %>/<%= meta.jsComponentDir %>/",
                    loader: "oz.js",
                    disableAutoSuffix: true
                }
            },
            browsers: {
                src: 'examples/js/browsers_test.js',
                config: {
                    baseUrl: "<%= meta.jsComponentDir %>/",
                    loader: "oz.js"
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
                files: [{
                    expand: true,
                    cwd: 'pics/',
                    src: ['**/*.{png,jpg}'],
                    dest: '<%= meta.targetDir %>/pics/'
                }]
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
            target_to_examples: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.targetDir %>/js/',
                    src: ['**'],
                    dest: '<%= meta.examplesDir %>/dist/js/'
                }, {
                    expand: true,
                    cwd: '<%= meta.targetDir %>/css/',
                    src: ['**'],
                    dest: '<%= meta.examplesDir %>/dist/css/'
                }]
            },
            target_to_pub: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.targetDir %>/js/',
                    src: ['**'],
                    dest: '<%= meta.jsPublicDir %>/'
                }, {
                    expand: true,
                    cwd: '<%= meta.targetDir %>/css/',
                    src: ['**'],
                    dest: '<%= meta.cssPublicDir %>/'
                }]
            },
            dist_to_pub: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/js/',
                    src: ['**', '!**/*.min.*'],
                    dest: '<%= meta.jsPublicDir %>/'
                }, {
                    expand: true,
                    cwd: '<%= meta.distDir %>/css/',
                    src: ['**', '!**/*.min.*'],
                    dest: '<%= meta.cssPublicDir %>/'
                }]
            },
            release_to_examples: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.releaseDir %>/js/',
                    src: ['**'],
                    dest: '<%= meta.examplesDir %>/dist/js/'
                }, {
                    expand: true,
                    cwd: '<%= meta.releaseDir %>/css/',
                    src: ['**'],
                    dest: '<%= meta.examplesDir %>/dist/css/'
                }]
            },
            min_to_pub: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/js/',
                    src: ['**/*.min.*'],
                    dest: '<%= meta.jsPublicDir %>/'
                }, {
                    expand: true,
                    cwd: '<%= meta.distDir %>/css/',
                    src: ['**/*.min.*'],
                    dest: '<%= meta.cssPublicDir %>/'
                }]
            },
            restore: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.releaseDir %>/',
                    src: ['**'],
                    dest: '<%= meta.distDir %>/'
                }]
            },
            release: {
                files: [{
                    expand: true,
                    cwd: '<%= meta.distDir %>/',
                    src: ['**'],
                    dest: '<%= meta.releaseDir %>/'
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
                    src: ['./*.js', 'js/**/*.js', '!<%= meta.jsComponentDir %>/**', '!<%= meta.jstplDir %>/**']
                }
            },
            dist: {
                files: {
                    src: ['./*.js', 'js/**/*.js', '!<%= meta.jsComponentDir %>/**', '!<%= meta.jstplDir %>/**']
                }
            }
        },

        complexity: {
            generic: {
                src: ['js/<%= pkg.name %>/**/*.js', '!<%= meta.jstplDir %>/**'],
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
                    hostname: 'localhost',
                    port: 9001,
                    base: 'examples/',
                    keepalive: true
                }
            }
        },

        watch: {
            js: {
                files: [
                    'js/**/*.js', 
                    '!<%= meta.jstplDir %>/**',
                    'examples/js/**/*.js',
                    '!examples/js/**/*_pack.js'
                ],
                tasks: [
                    'dev:js',
                    'test'
                ]
            },
            css: {
                files: ['css/**/*.scss'],
                tasks: [
                    'dev:css',
                    'test'
                ]
            },
            tpl: {
                files: ['tpl/**/*.tpl'],
                tasks: [
                    'dev:tpl',
                    'test'
                ]
            },
            img: {
                files: ['pics/**/*.{png,jpg}'],
                tasks: [
                    'dev:img',
                    'test'
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
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-complexity');
    grunt.loadNpmTasks('grunt-furnace');
    grunt.loadNpmTasks('grunt-dispatch');
    grunt.loadNpmTasks('grunt-ozjs');

    grunt.registerTask('dev:js', [
        'clean:target_js', 
        'ozma',
    ]);

    grunt.registerTask('dev:css', [
        'clean:target_css', 
        'compass',
    ]);

    grunt.registerTask('dev:img', [
        'clean:target_pics', 
        'imagemin', 
        'dev:css'
    ]);

    grunt.registerTask('dev:tpl', [
        'clean:jstpl',
        'furnace:tpl', 
        'dev:js'
    ]);

    grunt.registerTask('dev', [
        'dev:tpl',
        'dev:img'
    ]);
    
    grunt.registerTask('build', [
        'clean:dist',
        'concat',
        'uglify', 
        'cssmin'
    ]);

    grunt.registerTask('test', [
        'clean:examples_dist',
        'copy:target_to_examples',
        'copy:target_to_pub'
    ]);

    grunt.registerTask('restore', [
        'clean:examples_dist',
        'copy:release_to_examples',
        'clean:dist',
        'copy:restore'
    ]);

    grunt.registerTask('default', [
        'jshint:dist',
        'dev',
        'restore'
    ]);

    grunt.registerTask('deploy', [
        'build',
        'copy:dist_to_pub'
    ]);

    grunt.registerTask('upstream', [
        'clean:jsComponent',
        'clean:cssMoui',
        'dispatch'
    ]);

    grunt.registerTask('publish', [
        'jshint:dist',
        'dev',
        'build',
        'copy:release',
        'restore'
    ]);

};
