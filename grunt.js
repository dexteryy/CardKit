
module.exports = function(grunt) {

    grunt.initConfig({
        meta: {
            name: 'cardkit',
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
        concat: {
            dist: {
                src: ['<%= meta.distDir %>/js/main.js'],
                dest: '<%= meta.staticDir %>/js/<%= meta.name %>.js'
            }
        },
        min: {
            dist: {
                src: ['<config:concat.dist.dest>'],
                dest: '<%= meta.staticDir %>/js/<%= meta.name %>.min.js'
            }
        },
        lint: {
            files: ['grunt.js', '<%= meta.distDir %>/**/*.js']
        },
        watch: {
            files: 'js/**/*.js',
            tasks: 'ozma:main'
        },
        jshint: {},
        uglify: {}
    });

    grunt.loadNpmTasks('grunt-ozjs');
    //grunt.loadNpmTasks('grunt-contrib-watch');
    
    grunt.registerTask('default', 'ozma:main concat min');

};
