<!---
layout: intro
title: CardKit
-->

# CardKit (v2)

CardKit is a mobile UI library provides a series of building blocks to help you build mobile web apps quickly and simply, or transfer entire website to mobile-first web app for touch devices. 

CardKit building blocks are all _use-html-as-configure-style_ (like Custom Elements, directive...) components built on [DarkDOM](https://github.com/dexteryy/DarkDOM) and [Moui](https://github.com/dexteryy/moui).

## Usages and Examples

* [Components Gallery App](http://douban-f2e.github.io/cardkit-demo-gallery)
* [To-do App](https://github.com/douban-f2e/cardkit-demo-todoapp)
* [Custom DarkDOM Components](https://github.com/douban-f2e/cardkit-demo-darkdom)

## References

* Presentation in QCon Beijing 2014 (in Chinese): [slides + transcript](http://www.douban.com/note/347692465/)

### In the Real World

![douban apps](http://douban-f2e.github.io/cardkit-demo-gallery/screenshot/doubanapp.png)

## Installation

Install via bower:

```
bower install cardkit
```

Or download directly:

* Packaged version without dependencies  
  [cardkit.js](https://github.com/douban-f2e/CardKit/blob/master/dist/cardkit.js)  
  [cardkit.min.js](https://github.com/douban-f2e/CardKit/blob/master/dist/cardkit.min.js)  
* Packaged version with dependencies  
  [cardkit-standalone.js](https://github.com/douban-f2e/CardKit/blob/master/dist/cardkit-standalone.js)  
  [cardkit-standalone.min.js](https://github.com/douban-f2e/CardKit/blob/master/dist/cardkit-standalone.min.js)

## Quick Start for building

### Prepare the environment

1. node, npm
2. [grunt v0.4](http://gruntjs.com/getting-started) - `npm install grunt-cli -g`
3. [bower v0.10.0+](http://bower.io/) - `npm install bower -g`
4. ruby, gem, [bundler](http://gembundler.com/)

### Install dependencies

1. `npm install`
2. `bundle install`
3. `bower install`

### The first build

1. `grunt`

## License

Copyright (c) 2013-2014 douban.com
Licensed under the MIT license.

