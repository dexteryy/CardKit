
module.exports = function(grunt) {

    var pkg = grunt.file.readJSON('package.json');

    grunt.initConfig({
        pkg: pkg,

        dispatch: {
            options: {
                directory: "bower_components"
            },
            "mo": {
                use: {
                    "build/vendor/mo/": ["**/*.js", "!**/Gruntfile.js"]
                }
            },
            "darkdom": {
                use: {
                    "build/vendor/": "darkdom.js"
                }
            },
            "eventmaster": {
                use: {
                    "build/vendor/": "eventmaster.js"
                }
            },
            "dollar": {
                use: {
                    "build/vendor/": ["**/*.js", "!**/Gruntfile.js"]
                }
            },
            "soviet": {
                use: {
                    "build/vendor/": "soviet.js"
                }
            },
            "momo": {
                use: {
                    "build/vendor/": ["**/*.js", "!**/Gruntfile.js"]
                }
            },
            "moui": {
                use: [{
                    cwd: "scss/moui",
                    src: ["**"],
                    dest: "scss/moui/"
                }, {
                    src: ["**/*.js", "!**/Gruntfile.js"],
                    dest: "build/vendor/moui/"
                }, {
                    cwd: "asset",
                    src: ["**"],
                    dest: "asset/"
                }]
            },
        },

        clean: {
            vendor: ["build/vendor", "scss/moui"],
            dist: ["dist", "cardkit/tpl"],
        },

        copy: {
            cardkit: {
                files: [{
                    'build/vendor/': ['cardkit/**', 'cardkit.js']
                }]
            }
        },

        furnace: {
            cardkit_tpl: {
                options: {
                    importas: 'tpl',
                    exportas: 'amd'
                },
                files: [{
                    expand: true,
                    cwd: 'tpl/cardkit',
                    src: ['**/*.tpl'],
                    dest: 'build/vendor/cardkit/tpl',
                    ext: '.js'
                }]
            }
        },

        imagemin: {
            main: {
                options: {
                    optimizationLevel: 3
                },
                files: [{
                    expand: true,
                    cwd: 'asset/',
                    src: ['**/*.{png,gif,jpg}'],
                    dest: 'dist/pics/'
                }]
            }
        },

        ozma: {
            cardkit: {
                src: 'build/cardkit.js',
                config: {
                    baseUrl: "build/vendor",
                    distUrl: "dist/vendor",
                    loader: false,
                    ignore: [
                        'mo/lang', 'mo/lang/es5', 'mo/lang/type', 'mo/lang/mix',
                        'mo/browsers',
                        'mo/network',
                        'mo/template', 'mo/template/micro',
                        'dollar',
                        'soviet',
                        'darkdom',
                        'eventmaster',
                        'moui/control',
                        'moui/picker',
                        'moui/ranger',
                        'moui/actionview',
                        'moui/modalview',
                        'moui/growl',
                        'momo/base',
                        'momo/tap'
                    ],
                    disableAutoSuffix: true
                },
                "library-release": true,
            },
            standalone: {
                src: 'build/cardkit-standalone.js',
                config: {
                    baseUrl: "build/vendor",
                    distUrl: "dist/vendor",
                    loader: '../../node_modules/ozjs/oz.js',
                    disableAutoSuffix: true
                }
            },
        },

        compass: {
            main: {
                options: {
                    config: 'scss/config.rb',
                    sassDir: 'scss',
                    cssDir: 'dist/css',
                    imagesDir: 'dist/pics',
                    relativeAssets: true,
                    outputStyle: 'expanded',
                    noLineComments: false,
                    require: [
                        'compass-normalize',
                        'ceaser-easing',
                        'animate',
                        'compass-recipes'
                    ],
                    environment: 'production'
                }
            }
        },

        uglify: {
            main: {
                files: [{
                    expand: true,
                    cwd: 'dist/',
                    src: ['**/*.js'],
                    dest: 'dist/',
                    ext: '.min.js'
                }]
            }
        },

        cssmin: {
            main: {
                files: [{
                    expand: true,
                    cwd: 'dist/css/',
                    src: ['**/*.css'],
                    dest: 'dist/css/',
                    ext: '.min.css'
                }]
            }
        },

        jshint: {
            options: pkg.jshintConfig,
            dist: {
                files: {
                    src: [
                        'cardkit.js', 
                        'cardkit/**/*.js', 
                        '!cardkit/tpl/**'
                    ]
                }
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
    grunt.loadNpmTasks('grunt-furnace');
    grunt.loadNpmTasks('grunt-dispatch');
    grunt.loadNpmTasks('grunt-ozjs');

    grunt.registerTask('update', [
        'clean:vendor',
        'dispatch',
    ]);

    grunt.registerTask('publish', [
        'jshint:dist',
        'clean:dist',
        'copy:cardkit',
        'furnace',
        'imagemin',
        'compass',
        'ozma',
        'cssmin',
        'uglify',
    ]);

    grunt.registerTask('default', [
        'update',
        'publish',
    ]);

};
