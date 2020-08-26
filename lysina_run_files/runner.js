'use strict';
(function() {
  /**
   * @param {?} outerContainerId
   * @param {!Object} opt_config
   * @return {?}
   */
  function Runner(outerContainerId, opt_config) {
    if (Runner.instance_) {
      return Runner.instance_;
    }
    Runner.instance_ = this;
    /** @type {(Element|null)} */
    this.outerContainerEl = document.querySelector(outerContainerId);
    /** @type {null} */
    this.containerEl = null;
    this.config = opt_config || Runner.config;
    this.dimensions = Runner.defaultDimensions;
    /** @type {null} */
    this.canvas = null;
    /** @type {null} */
    this.canvasCtx = null;
    /** @type {null} */
    this.tRex = null;
    /** @type {null} */
    this.distanceMeter = null;
    /** @type {number} */
    this.distanceRan = 0;
    /** @type {number} */
    this.highestScore = 0;
    /** @type {number} */
    this.time = 0;
    /** @type {number} */
    this.runningTime = 0;
    /** @type {number} */
    this.msPerFrame = 1000 / FPS;
    this.currentSpeed = this.config.SPEED;
    /** @type {!Array} */
    this.obstacles = [];
    /** @type {boolean} */
    this.started = false;
    /** @type {boolean} */
    this.activated = false;
    /** @type {boolean} */
    this.crashed = false;
    /** @type {boolean} */
    this.paused = false;
    /** @type {null} */
    this.resizeTimerId_ = null;
    /** @type {number} */
    this.playCount = 0;
    /** @type {null} */
    this.audioBuffer = null;
    this.soundFx = {};
    /** @type {null} */
    this.audioContext = null;
    this.images = {};
    /** @type {number} */
    this.imagesLoaded = 0;
    this.loadImages();
  }
  /**
   * @param {number} min
   * @param {number} max
   * @return {?}
   */
  function getRandomNum(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  /**
   * @param {number} duration
   * @return {undefined}
   */
  function vibrate(duration) {
    if (IS_MOBILE) {
      window.navigator["vibrate"](duration);
    }
  }
  /**
   * @param {!Node} video
   * @param {number} size
   * @param {number} height
   * @param {string} opt_classname
   * @return {?}
   */
  function createCanvas(video, size, height, opt_classname) {
    /** @type {!Element} */
    var canvas = document.createElement("canvas");
    /** @type {string} */
    canvas.className = opt_classname ? Runner.classes.CANVAS + " " + opt_classname : Runner.classes.CANVAS;
    /** @type {number} */
    canvas.width = size;
    /** @type {number} */
    canvas.height = height;
    video.appendChild(canvas);
    return canvas;
  }
  /**
   * @param {!NodeList} base64String
   * @return {?}
   */
  function decodeBase64ToArrayBuffer(base64String) {
    /** @type {number} */
    var length = base64String.length / 4 * 3;
    /** @type {string} */
    var str = atob(base64String);
    /** @type {!ArrayBuffer} */
    var newBuffer = new ArrayBuffer(length);
    /** @type {!Uint8Array} */
    var view = new Uint8Array(newBuffer);
    /** @type {number} */
    var i = 0;
    for (; i < length; i++) {
      /** @type {number} */
      view[i] = str.charCodeAt(i);
    }
    return view.buffer;
  }
  /**
   * @param {!HTMLCanvasElement} canvas
   * @param {?} textSprite
   * @param {?} restartImg
   * @param {!Object} dimensions
   * @return {undefined}
   */
  function GameOverPanel(canvas, textSprite, restartImg, dimensions) {
    /** @type {!HTMLCanvasElement} */
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext("2d");
    /** @type {!Object} */
    this.canvasDimensions = dimensions;
    this.textSprite = textSprite;
    this.restartImg = restartImg;
    this.draw();
  }
  /**
   * @param {!Object} obstacle
   * @param {!Object} tRex
   * @param {!CanvasRenderingContext2D} opt_canvasCtx
   * @return {?}
   */
  function checkForCollision(obstacle, tRex, opt_canvasCtx) {
    var obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;
    var tRexBox = new CollisionBox(tRex.xPos + 1, tRex.yPos + 1, tRex.config.WIDTH - 2, tRex.config.HEIGHT - 2);
    var obstacleBox = new CollisionBox(obstacle.xPos + 1, obstacle.yPos + 1, obstacle.typeConfig.width * obstacle.size - 2, obstacle.typeConfig.height - 2);
    if (opt_canvasCtx) {
      drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
    }
    if (boxCompare(tRexBox, obstacleBox)) {
      var collisionBoxes = obstacle.collisionBoxes;
      /** @type {!Array} */
      var tRexCollisionBoxes = Trex.collisionBoxes;
      /** @type {number} */
      var t = 0;
      for (; t < tRexCollisionBoxes.length; t++) {
        /** @type {number} */
        var i = 0;
        for (; i < collisionBoxes.length; i++) {
          var adjTrexBox = createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
          var adjObstacleBox = createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
          var crashed = boxCompare(adjTrexBox, adjObstacleBox);
          if (opt_canvasCtx) {
            drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
          }
          if (crashed) {
            return [adjTrexBox, adjObstacleBox];
          }
        }
      }
    }
    return false;
  }
  /**
   * @param {!Object} box
   * @param {!Object} adjustment
   * @return {?}
   */
  function createAdjustedCollisionBox(box, adjustment) {
    return new CollisionBox(box.x + adjustment.x, box.y + adjustment.y, box.width, box.height);
  }
  /**
   * @param {!CanvasRenderingContext2D} canvasCtx
   * @param {!Object} tRexBox
   * @param {!Object} obstacleBox
   * @return {undefined}
   */
  function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
    canvasCtx.save();
    /** @type {string} */
    canvasCtx.strokeStyle = "#f00";
    canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);
    /** @type {string} */
    canvasCtx.strokeStyle = "#0f0";
    canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y, obstacleBox.width, obstacleBox.height);
    canvasCtx.restore();
  }
  /**
   * @param {!Object} tRexBox
   * @param {!Object} obstacleBox
   * @return {?}
   */
  function boxCompare(tRexBox, obstacleBox) {
    /** @type {boolean} */
    var crashed = false;
    var tRexBoxX = tRexBox.x;
    var tRexBoxY = tRexBox.y;
    var obstacleBoxX = obstacleBox.x;
    var obstacleBoxY = obstacleBox.y;
    if (tRexBox.x < obstacleBoxX + obstacleBox.width && tRexBox.x + tRexBox.width > obstacleBoxX && tRexBox.y < obstacleBox.y + obstacleBox.height && tRexBox.height + tRexBox.y > obstacleBox.y) {
      /** @type {boolean} */
      crashed = true;
    }
    return crashed;
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @return {undefined}
   */
  function CollisionBox(x, y, w, h) {
    /** @type {number} */
    this.x = x;
    /** @type {number} */
    this.y = y;
    /** @type {number} */
    this.width = w;
    /** @type {number} */
    this.height = h;
  }
  /**
   * @param {!Object} canvasCtx
   * @param {boolean} type
   * @param {string} obstacleImg
   * @param {!Object} dimensions
   * @param {number} gapCoefficient
   * @param {undefined} speed
   * @return {undefined}
   */
  function Obstacle(canvasCtx, type, obstacleImg, dimensions, gapCoefficient, speed) {
    /** @type {!Object} */
    this.canvasCtx = canvasCtx;
    /** @type {string} */
    this.image = obstacleImg;
    /** @type {boolean} */
    this.typeConfig = type;
    /** @type {number} */
    this.gapCoefficient = gapCoefficient;
    this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
    /** @type {!Object} */
    this.dimensions = dimensions;
    /** @type {boolean} */
    this.remove = false;
    /** @type {number} */
    this.xPos = 0;
    this.yPos = this.typeConfig.yPos;
    /** @type {number} */
    this.width = 0;
    /** @type {!Array} */
    this.collisionBoxes = [];
    /** @type {number} */
    this.gap = 0;
    this.init(speed);
  }
  /**
   * @param {!Element} canvas
   * @param {string} image
   * @return {undefined}
   */
  function Trex(canvas, image) {
    /** @type {!Element} */
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext("2d");
    /** @type {string} */
    this.image = image;
    /** @type {number} */
    this.xPos = 0;
    /** @type {number} */
    this.yPos = 0;
    /** @type {number} */
    this.groundYPos = 0;
    /** @type {number} */
    this.currentFrame = 0;
    /** @type {!Array} */
    this.currentAnimFrames = [];
    /** @type {number} */
    this.blinkDelay = 0;
    /** @type {number} */
    this.animStartTime = 0;
    /** @type {number} */
    this.timer = 0;
    /** @type {number} */
    this.msPerFrame = 1000 / FPS;
    this.config = Trex.config;
    /** @type {string} */
    this.status = Trex.status.WAITING;
    /** @type {boolean} */
    this.jumping = false;
    /** @type {number} */
    this.jumpVelocity = 0;
    /** @type {boolean} */
    this.reachedMinHeight = false;
    /** @type {boolean} */
    this.speedDrop = false;
    /** @type {number} */
    this.jumpCount = 0;
    /** @type {number} */
    this.jumpspotX = 0;
    this.init();
  }
  /**
   * @param {!Element} canvas
   * @param {string} spriteSheet
   * @param {undefined} canvasWidth
   * @return {undefined}
   */
  function DistanceMeter(canvas, spriteSheet, canvasWidth) {
    /** @type {!Element} */
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext("2d");
    /** @type {string} */
    this.image = spriteSheet;
    /** @type {number} */
    this.x = 0;
    /** @type {number} */
    this.y = 5;
    /** @type {number} */
    this.currentDistance = 0;
    /** @type {number} */
    this.maxScore = 0;
    /** @type {number} */
    this.highScore = 0;
    /** @type {null} */
    this.container = null;
    /** @type {!Array} */
    this.digits = [];
    /** @type {boolean} */
    this.acheivement = false;
    /** @type {string} */
    this.defaultString = "";
    /** @type {number} */
    this.flashTimer = 0;
    /** @type {number} */
    this.flashIterations = 0;
    this.config = DistanceMeter.config;
    this.init(canvasWidth);
  }
  /**
   * @param {string} canvas
   * @param {string} cloudImg
   * @param {number} containerWidth
   * @return {undefined}
   */
  function Cloud(canvas, cloudImg, containerWidth) {
    /** @type {string} */
    this.canvas = canvas;
    this.canvasCtx = this.canvas.getContext("2d");
    /** @type {string} */
    this.image = cloudImg;
    /** @type {number} */
    this.containerWidth = containerWidth;
    /** @type {number} */
    this.xPos = containerWidth;
    /** @type {number} */
    this.yPos = 0;
    /** @type {boolean} */
    this.remove = false;
    this.cloudGap = getRandomNum(Cloud.config.MIN_CLOUD_GAP, Cloud.config.MAX_CLOUD_GAP);
    this.init();
  }
  /**
   * @param {!Element} canvas
   * @param {string} bgImg
   * @return {undefined}
   */
  function HorizonLine(canvas, bgImg) {
    /** @type {string} */
    this.image = bgImg;
    /** @type {!Element} */
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext("2d");
    this.sourceDimensions = {};
    this.dimensions = HorizonLine.dimensions;
    /** @type {!Array} */
    this.sourceXPos = [0, this.dimensions.WIDTH];
    /** @type {!Array} */
    this.xPos = [];
    /** @type {number} */
    this.yPos = 0;
    /** @type {number} */
    this.bumpThreshold = 0.5;
    this.setSourceDimensions();
    this.draw();
  }
  /**
   * @param {!HTMLElement} canvas
   * @param {?} images
   * @param {!Object} dimensions
   * @param {number} gapCoefficient
   * @return {undefined}
   */
  function Horizon(canvas, images, dimensions, gapCoefficient) {
    /** @type {!HTMLElement} */
    this.canvas = canvas;
    this.canvasCtx = this.canvas.getContext("2d");
    this.config = Horizon.config;
    /** @type {!Object} */
    this.dimensions = dimensions;
    /** @type {number} */
    this.gapCoefficient = gapCoefficient;
    /** @type {!Array} */
    this.obstacles = [];
    /** @type {!Array} */
    this.horizonOffsets = [0, 0];
    /** @type {number} */
    this.cloudFrequency = this.config.CLOUD_FREQUENCY;
    /** @type {!Array} */
    this.clouds = [];
    this.cloudImg = images.CLOUD;
    /** @type {number} */
    this.cloudSpeed = this.config.BG_CLOUD_SPEED;
    this.horizonImg = images.HORIZON;
    /** @type {null} */
    this.horizonLine = null;
    this.obstacleImgs = {
      CACTUS_SMALL : images.CACTUS_SMALL,
      CACTUS_LARGE : images.CACTUS_LARGE
    };
    this.init();
  }
  /** @type {function(?, !Object): ?} */
  window["Runner"] = Runner;
  /** @type {number} */
  var DEFAULT_WIDTH = 600;
  /** @type {number} */
  var FPS = 60;
  /** @type {boolean} */
  var IS_HIDPI = window.devicePixelRatio > 1;
  /** @type {boolean} */
  var IS_MOBILE = window.navigator.userAgent.indexOf("Mobi") > -1;
  /** @type {boolean} */
  var IS_TOUCH_ENABLED = "ontouchstart" in window;
  Runner.config = {
    ACCELERATION : 0.001,
    BG_CLOUD_SPEED : 0.2,
    BOTTOM_PAD : 10,
    CLEAR_TIME : 3000,
    CLOUD_FREQUENCY : 0.5,
    GAMEOVER_CLEAR_TIME : 750,
    GAP_COEFFICIENT : 0.6,
    GRAVITY : 0.6,
    INITIAL_JUMP_VELOCITY : 12,
    MAX_CLOUDS : 6,
    MAX_OBSTACLE_LENGTH : 3,
    MAX_SPEED : 12,
    MIN_JUMP_HEIGHT : 35,
    MOBILE_SPEED_COEFFICIENT : 1.2,
    RESOURCE_TEMPLATE_ID : "audio-resources",
    SPEED : 6,
    SPEED_DROP_COEFFICIENT : 3
  };
  Runner.defaultDimensions = {
    WIDTH : DEFAULT_WIDTH,
    HEIGHT : 150
  };
  Runner.classes = {
    CANVAS : "runner-canvas",
    CONTAINER : "runner-container",
    CRASHED : "crashed",
    ICON : "icon-offline",
    TOUCH_CONTROLLER : "controller"
  };
  Runner.imageSources = {
    LDPI : [{
      name : "CACTUS_LARGE",
      id : "1x-obstacle-large"
    }, {
      name : "CACTUS_SMALL",
      id : "1x-obstacle-small"
    }, {
      name : "CLOUD",
      id : "1x-cloud"
    }, {
      name : "HORIZON",
      id : "1x-horizon"
    }, {
      name : "RESTART",
      id : "1x-restart"
    }, {
      name : "TEXT_SPRITE",
      id : "1x-text"
    }, {
      name : "TREX",
      id : "1x-trex"
    }],
    HDPI : [{
      name : "CACTUS_LARGE",
      id : "2x-obstacle-large"
    }, {
      name : "CACTUS_SMALL",
      id : "2x-obstacle-small"
    }, {
      name : "CLOUD",
      id : "2x-cloud"
    }, {
      name : "HORIZON",
      id : "2x-horizon"
    }, {
      name : "RESTART",
      id : "2x-restart"
    }, {
      name : "TEXT_SPRITE",
      id : "2x-text"
    }, {
      name : "TREX",
      id : "2x-trex"
    }]
  };
  Runner.sounds = {
    BUTTON_PRESS : "offline-sound-press",
    HIT : "offline-sound-hit",
    SCORE : "offline-sound-reached"
  };
  Runner.keycodes = {
    JUMP : {
      38 : 1,
      32 : 1
    },
    DUCK : {
      40 : 1
    },
    RESTART : {
      13 : 1
    }
  };
  Runner.events = {
    ANIM_END : "webkitAnimationEnd",
    CLICK : "click",
    KEYDOWN : "keydown",
    KEYUP : "keyup",
    MOUSEDOWN : "mousedown",
    MOUSEUP : "mouseup",
    RESIZE : "resize",
    TOUCHEND : "touchend",
    TOUCHSTART : "touchstart",
    VISIBILITY : "visibilitychange",
    BLUR : "blur",
    FOCUS : "focus",
    LOAD : "load"
  };
  Runner.prototype = {
    updateConfigSetting : function(setting, value) {
      if (setting in this.config && value != undefined) {
        this.config[setting] = value;
        switch(setting) {
          case "GRAVITY":
          case "MIN_JUMP_HEIGHT":
          case "SPEED_DROP_COEFFICIENT":
            this.tRex.config[setting] = value;
            break;
          case "INITIAL_JUMP_VELOCITY":
            this.tRex.setJumpVelocity(value);
            break;
          case "SPEED":
            this.setSpeed(value);
            break;
        }
      }
    },
    loadImages : function() {
      /** @type {!Array} */
      var imageSources = IS_HIDPI ? Runner.imageSources.HDPI : Runner.imageSources.LDPI;
      /** @type {number} */
      var numImages = imageSources.length;
      /** @type {number} */
      var i = numImages - 1;
      for (; i >= 0; i--) {
        var imgSource = imageSources[i];
        /** @type {(Element|null)} */
        this.images[imgSource.name] = document.getElementById(imgSource.id);
      }
      this.init();
    },
    loadSounds : function() {
      /** @type {!AudioContext} */
      this.audioContext = new AudioContext;
      var resourceTemplate = document.getElementById(this.config.RESOURCE_TEMPLATE_ID).content;
      var index;
      for (index in Runner.sounds) {
        /** @type {(Element|null)} */
        var audioData = document.getElementById(Runner.sounds[index]);
        /** @type {(Element|null)} */
        this.soundFx[index] = audioData;
      }
    },
    setSpeed : function(opt_speed) {
      var speed = opt_speed || this.currentSpeed;
      if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
        /** @type {number} */
        var mobileSpeed = speed * this.dimensions.WIDTH / DEFAULT_WIDTH * this.config.MOBILE_SPEED_COEFFICIENT;
        this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed;
      } else {
        if (opt_speed) {
          /** @type {number} */
          this.currentSpeed = opt_speed;
        }
      }
    },
    init : function() {
      /** @type {string} */
      document.querySelector("." + Runner.classes.ICON).style.visibility = "hidden";
      this.adjustDimensions();
      this.setSpeed();
      /** @type {!Element} */
      this.containerEl = document.createElement("div");
      /** @type {string} */
      this.containerEl.className = Runner.classes.CONTAINER;
      this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH, this.dimensions.HEIGHT, Runner.classes.PLAYER);
      this.canvasCtx = this.canvas.getContext("2d");
      /** @type {string} */
      this.canvasCtx.fillStyle = "#f7f7f7";
      this.canvasCtx.fill();
      Runner.updateCanvasScaling(this.canvas);
      this.horizon = new Horizon(this.canvas, this.images, this.dimensions, this.config.GAP_COEFFICIENT);
      this.distanceMeter = new DistanceMeter(this.canvas, this.images.TEXT_SPRITE, this.dimensions.WIDTH);
      this.tRex = new Trex(this.canvas, this.images.TREX);
      this.outerContainerEl.appendChild(this.containerEl);
      if (IS_MOBILE) {
        this.createTouchController();
      }
      this.startListening();
      this.update();
      window.addEventListener(Runner.events.RESIZE, this.debounceResize.bind(this));
    },
    createTouchController : function() {
      /** @type {!Element} */
      this.touchController = document.createElement("div");
      /** @type {string} */
      this.touchController.className = Runner.classes.TOUCH_CONTROLLER;
    },
    debounceResize : function() {
      if (!this.resizeTimerId_) {
        /** @type {number} */
        this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250);
      }
    },
    adjustDimensions : function() {
      clearInterval(this.resizeTimerId_);
      /** @type {null} */
      this.resizeTimerId_ = null;
      var boxStyles = window.getComputedStyle(this.outerContainerEl);
      /** @type {number} */
      var padding = Number(boxStyles.paddingLeft.substr(0, boxStyles.paddingLeft.length - 2));
      /** @type {number} */
      this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2 > DEFAULT_WIDTH ? DEFAULT_WIDTH : this.outerContainerEl.offsetWidth - padding * 2;
      if (this.canvas) {
        /** @type {number} */
        this.canvas.width = this.dimensions.WIDTH;
        this.canvas.height = this.dimensions.HEIGHT;
        Runner.updateCanvasScaling(this.canvas);
        this.distanceMeter.calcXPos(this.dimensions.WIDTH);
        this.clearCanvas();
        this.horizon.update(0, 0, true);
        this.tRex.update(0);
        if (this.activated || this.crashed) {
          /** @type {string} */
          this.containerEl.style.width = this.dimensions.WIDTH + "px";
          /** @type {string} */
          this.containerEl.style.height = this.dimensions.HEIGHT + "px";
          this.distanceMeter.update(0, Math.ceil(this.distanceRan));
          this.stop();
        } else {
          this.tRex.draw(0, 0);
        }
        if (this.crashed && this.gameOverPanel) {
          this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
          this.gameOverPanel.draw();
        }
      }
    },
    playIntro : function() {
      if (!this.started && !this.crashed) {
        /** @type {boolean} */
        this.playingIntro = true;
        /** @type {boolean} */
        this.tRex.playingIntro = true;
        /** @type {string} */
        var open_moz = "@-webkit-keyframes intro { " + "from { width:" + Trex.config.WIDTH + "px }" + "to { width: " + this.dimensions.WIDTH + "px }" + "}";
        document.styleSheets[1].insertRule(open_moz, 0);
        this.containerEl.addEventListener(Runner.events.ANIM_END, this.startGame.bind(this));
        /** @type {string} */
        this.containerEl.style.webkitAnimation = "intro .4s ease-out 1 both";
        /** @type {string} */
        this.containerEl.style.width = this.dimensions.WIDTH + "px";
        if (this.touchController) {
          this.outerContainerEl.appendChild(this.touchController);
        }
        /** @type {boolean} */
        this.activated = true;
        /** @type {boolean} */
        this.started = true;
      } else {
        if (this.crashed) {
          this.restart();
        }
      }
    },
    startGame : function() {
      /** @type {number} */
      this.runningTime = 0;
      /** @type {boolean} */
      this.playingIntro = false;
      /** @type {boolean} */
      this.tRex.playingIntro = false;
      /** @type {string} */
      this.containerEl.style.webkitAnimation = "";
      this.playCount++;
      window.addEventListener(Runner.events.VISIBILITY, this.onVisibilityChange.bind(this));
      window.addEventListener(Runner.events.BLUR, this.onVisibilityChange.bind(this));
      window.addEventListener(Runner.events.FOCUS, this.onVisibilityChange.bind(this));
    },
    clearCanvas : function() {
      this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
    },
    update : function() {
      /** @type {boolean} */
      this.drawPending = false;
      /** @type {number} */
      var now = performance.now();
      /** @type {number} */
      var deltaTime = now - (this.time || now);
      /** @type {number} */
      this.time = now;
      if (this.activated) {
        this.clearCanvas();
        if (this.tRex.jumping) {
          this.tRex.updateJump(deltaTime, this.config);
        }
        this.runningTime += deltaTime;
        /** @type {boolean} */
        var hasObstacles = this.runningTime > this.config.CLEAR_TIME;
        if (this.tRex.jumpCount == 1 && !this.playingIntro) {
          this.playIntro();
        }
        if (this.playingIntro) {
          this.horizon.update(0, this.currentSpeed, hasObstacles);
        } else {
          /** @type {number} */
          deltaTime = !this.started ? 0 : deltaTime;
          this.horizon.update(deltaTime, this.currentSpeed, hasObstacles);
        }
        var collision = hasObstacles && checkForCollision(this.horizon.obstacles[0], this.tRex);
        if (!collision) {
          this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;
          if (this.currentSpeed < this.config.MAX_SPEED) {
            this.currentSpeed += this.config.ACCELERATION;
          }
        } else {
          this.gameOver();
        }
        if (this.distanceMeter.getActualDistance(this.distanceRan) > this.distanceMeter.maxScore) {
          /** @type {number} */
          this.distanceRan = 0;
        }
        var v = this.distanceMeter.update(deltaTime, Math.ceil(this.distanceRan));
        if (v) {
          this.playSound(this.soundFx.SCORE);
        }
      }
      if (!this.crashed) {
        this.tRex.update(deltaTime);
        this.raq();
      }
    },
    handleEvent : function(e) {
      return function(canCreateDiscussions, events) {
        switch(canCreateDiscussions) {
          case events.KEYDOWN:
          case events.TOUCHSTART:
          case events.MOUSEDOWN:
            this.onKeyDown(e);
            break;
          case events.KEYUP:
          case events.TOUCHEND:
          case events.MOUSEUP:
            this.onKeyUp(e);
            break;
        }
      }.bind(this)(e.type, Runner.events);
    },
    startListening : function() {
      document.addEventListener(Runner.events.KEYDOWN, this);
      document.addEventListener(Runner.events.KEYUP, this);
      if (IS_MOBILE) {
        this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
        this.touchController.addEventListener(Runner.events.TOUCHEND, this);
        this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
      } else {
        document.addEventListener(Runner.events.MOUSEDOWN, this);
        document.addEventListener(Runner.events.MOUSEUP, this);
      }
    },
    stopListening : function() {
      document.removeEventListener(Runner.events.KEYDOWN, this);
      document.removeEventListener(Runner.events.KEYUP, this);
      if (IS_MOBILE) {
        this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
        this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
        this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
      } else {
        document.removeEventListener(Runner.events.MOUSEDOWN, this);
        document.removeEventListener(Runner.events.MOUSEUP, this);
      }
    },
    onKeyDown : function(e) {
      if (!this.crashed && (Runner.keycodes.JUMP[String(e.keyCode)] || e.type == Runner.events.TOUCHSTART)) {
        if (!this.activated) {
          this.loadSounds();
          /** @type {boolean} */
          this.activated = true;
        }
        if (!this.tRex.jumping) {
          this.playSound(this.soundFx.BUTTON_PRESS);
          this.tRex.startJump();
        }
      }
      if (this.crashed && e.type == Runner.events.TOUCHSTART && e.currentTarget == this.containerEl) {
        this.restart();
      }
      if (Runner.keycodes.DUCK[e.keyCode] && this.tRex.jumping) {
        e.preventDefault();
        this.tRex.setSpeedDrop();
      }
    },
    onKeyUp : function(e) {
      /** @type {string} */
      var keyCode = String(e.keyCode);
      var isjumpKey = Runner.keycodes.JUMP[keyCode] || e.type == Runner.events.TOUCHEND || e.type == Runner.events.MOUSEDOWN;
      if (this.isRunning() && isjumpKey) {
        this.tRex.endJump();
      } else {
        if (Runner.keycodes.DUCK[keyCode]) {
          /** @type {boolean} */
          this.tRex.speedDrop = false;
        } else {
          if (this.crashed) {
            /** @type {number} */
            var deltaTime = performance.now() - this.time;
            if (Runner.keycodes.RESTART[keyCode] || e.type == Runner.events.MOUSEUP && e.target == this.canvas || deltaTime >= this.config.GAMEOVER_CLEAR_TIME && Runner.keycodes.JUMP[keyCode]) {
              this.restart();
            }
          } else {
            if (this.paused && isjumpKey) {
              this.play();
            }
          }
        }
      }
    },
    raq : function() {
      if (!this.drawPending) {
        /** @type {boolean} */
        this.drawPending = true;
        /** @type {number} */
        this.raqId = requestAnimationFrame(this.update.bind(this));
      }
    },
    isRunning : function() {
      return !!this.raqId;
    },
    gameOver : function() {
      this.playSound(this.soundFx.HIT);
      vibrate(200);
      this.stop();
      /** @type {boolean} */
      this.crashed = true;
      /** @type {boolean} */
      this.distanceMeter.acheivement = false;
      this.tRex.update(100, Trex.status.CRASHED);
      if (!this.gameOverPanel) {
        this.gameOverPanel = new GameOverPanel(this.canvas, this.images.TEXT_SPRITE, this.images.RESTART, this.dimensions);
      } else {
        this.gameOverPanel.draw();
      }
      if (this.distanceRan > this.highestScore) {
        /** @type {number} */
        this.highestScore = Math.ceil(this.distanceRan);
        this.distanceMeter.setHighScore(this.highestScore);
      }
      /** @type {number} */
      this.time = performance.now();
    },
    stop : function() {
      /** @type {boolean} */
      this.activated = false;
      /** @type {boolean} */
      this.paused = true;
      cancelAnimationFrame(this.raqId);
      /** @type {number} */
      this.raqId = 0;
    },
    play : function() {
      if (!this.crashed) {
        /** @type {boolean} */
        this.activated = true;
        /** @type {boolean} */
        this.paused = false;
        this.tRex.update(0, Trex.status.RUNNING);
        /** @type {number} */
        this.time = performance.now();
        this.update();
      }
    },
    restart : function() {
      if (!this.raqId) {
        this.playCount++;
        /** @type {number} */
        this.runningTime = 0;
        /** @type {boolean} */
        this.activated = true;
        /** @type {boolean} */
        this.crashed = false;
        /** @type {number} */
        this.distanceRan = 0;
        this.setSpeed(this.config.SPEED);
        /** @type {number} */
        this.time = performance.now();
        this.containerEl.classList.remove(Runner.classes.CRASHED);
        this.clearCanvas();
        this.distanceMeter.reset(this.highestScore);
        this.horizon.reset();
        this.tRex.reset();
        this.playSound(this.soundFx.BUTTON_PRESS);
        this.update();
      }
    },
    onVisibilityChange : function(event) {
      if (document.hidden || document.webkitHidden || event.type == "blur") {
        this.stop();
      } else {
        this.play();
      }
    },
    playSound : function(snd) {
      if (snd) {
        snd.play();
      }
    }
  };
  /**
   * @param {!Object} canvas
   * @param {number} opt_width
   * @param {number} opt_height
   * @return {?}
   */
  Runner.updateCanvasScaling = function(canvas, opt_width, opt_height) {
    var context = canvas.getContext("2d");
    /** @type {number} */
    var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
    /** @type {number} */
    var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
    /** @type {number} */
    var ratio = devicePixelRatio / backingStoreRatio;
    if (devicePixelRatio !== backingStoreRatio) {
      var oldWidth = opt_width || canvas.width;
      var oldHeight = opt_height || canvas.height;
      /** @type {number} */
      canvas.width = oldWidth * ratio;
      /** @type {number} */
      canvas.height = oldHeight * ratio;
      /** @type {string} */
      canvas.style.width = oldWidth + "px";
      /** @type {string} */
      canvas.style.height = oldHeight + "px";
      context.scale(ratio, ratio);
      return true;
    }
    return false;
  };
  GameOverPanel.dimensions = {
    TEXT_X : 0,
    TEXT_Y : 13,
    TEXT_WIDTH : 191,
    TEXT_HEIGHT : 11,
    RESTART_WIDTH : 36,
    RESTART_HEIGHT : 32
  };
  GameOverPanel.prototype = {
    updateDimensions : function(width, opt_height) {
      /** @type {number} */
      this.canvasDimensions.WIDTH = width;
      if (opt_height) {
        /** @type {number} */
        this.canvasDimensions.HEIGHT = opt_height;
      }
    },
    draw : function() {
      var dimensions = GameOverPanel.dimensions;
      /** @type {number} */
      var centerX = this.canvasDimensions.WIDTH / 2;
      /** @type {number} */
      var textSourceX = dimensions.TEXT_X;
      /** @type {number} */
      var textSourceY = dimensions.TEXT_Y;
      /** @type {number} */
      var textSourceWidth = dimensions.TEXT_WIDTH;
      /** @type {number} */
      var textSourceHeight = dimensions.TEXT_HEIGHT;
      /** @type {number} */
      var textTargetX = Math.round(centerX - dimensions.TEXT_WIDTH / 2);
      /** @type {number} */
      var textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
      /** @type {number} */
      var textTargetWidth = dimensions.TEXT_WIDTH;
      /** @type {number} */
      var textTargetHeight = dimensions.TEXT_HEIGHT;
      /** @type {number} */
      var restartSourceWidth = dimensions.RESTART_WIDTH;
      /** @type {number} */
      var restartSourceHeight = dimensions.RESTART_HEIGHT;
      /** @type {number} */
      var restartTargetX = centerX - dimensions.RESTART_WIDTH / 2;
      /** @type {number} */
      var restartTargetY = this.canvasDimensions.HEIGHT / 2;
      if (IS_HIDPI) {
        /** @type {number} */
        textSourceY = textSourceY * 2;
        /** @type {number} */
        textSourceX = textSourceX * 2;
        /** @type {number} */
        textSourceWidth = textSourceWidth * 2;
        /** @type {number} */
        textSourceHeight = textSourceHeight * 2;
        /** @type {number} */
        restartSourceWidth = restartSourceWidth * 2;
        /** @type {number} */
        restartSourceHeight = restartSourceHeight * 2;
      }
      this.canvasCtx.drawImage(this.textSprite, textSourceX, textSourceY, textSourceWidth, textSourceHeight, textTargetX, textTargetY, textTargetWidth, textTargetHeight);
      this.canvasCtx.drawImage(this.restartImg, 0, 0, restartSourceWidth, restartSourceHeight, restartTargetX, restartTargetY, dimensions.RESTART_WIDTH, dimensions.RESTART_HEIGHT);
    }
  };
  /** @type {number} */
  Obstacle.MAX_GAP_COEFFICIENT = 1.5;
  /** @type {number} */
  Obstacle.MAX_OBSTACLE_LENGTH = 3;
  Obstacle.prototype = {
    init : function(speed) {
      this.cloneCollisionBoxes();
      if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
        /** @type {number} */
        this.size = 1;
      }
      /** @type {number} */
      this.width = this.typeConfig.width * this.size;
      /** @type {number} */
      this.xPos = this.dimensions.WIDTH - this.width;
      this.draw();
      if (this.size > 1) {
        /** @type {number} */
        this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width - this.collisionBoxes[2].width;
        /** @type {number} */
        this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
      }
      this.gap = this.getGap(this.gapCoefficient, speed);
    },
    draw : function() {
      var sourceWidth = this.typeConfig.width;
      var sourceHeight = this.typeConfig.height;
      if (IS_HIDPI) {
        /** @type {number} */
        sourceWidth = sourceWidth * 2;
        /** @type {number} */
        sourceHeight = sourceHeight * 2;
      }
      /** @type {number} */
      var sourceX = sourceWidth * this.size * (0.5 * (this.size - 1));
      this.canvasCtx.drawImage(this.image, sourceX, 0, sourceWidth * this.size, sourceHeight, this.xPos, this.yPos, this.typeConfig.width * this.size, this.typeConfig.height);
    },
    update : function(deltaTime, speed) {
      if (!this.remove) {
        this.xPos -= Math.floor(speed * FPS / 1000 * deltaTime);
        this.draw();
        if (!this.isVisible()) {
          /** @type {boolean} */
          this.remove = true;
        }
      }
    },
    getGap : function(gapCoefficient, speed) {
      /** @type {number} */
      var minGap = Math.round(this.width * speed + this.typeConfig.minGap * gapCoefficient);
      /** @type {number} */
      var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
      return getRandomNum(minGap, maxGap);
    },
    isVisible : function() {
      return this.xPos + this.width > 0;
    },
    cloneCollisionBoxes : function() {
      var collisionBoxes = this.typeConfig.collisionBoxes;
      /** @type {number} */
      var i = collisionBoxes.length - 1;
      for (; i >= 0; i--) {
        this.collisionBoxes[i] = new CollisionBox(collisionBoxes[i].x, collisionBoxes[i].y, collisionBoxes[i].width, collisionBoxes[i].height);
      }
    }
  };
  /** @type {!Array} */
  Obstacle.types = [{
    type : "CACTUS_SMALL",
    className : " cactus cactus-small ",
    width : 17,
    height : 35,
    yPos : 105,
    multipleSpeed : 3,
    minGap : 120,
    collisionBoxes : [new CollisionBox(0, 7, 5, 27), new CollisionBox(4, 0, 6, 34), new CollisionBox(10, 4, 7, 14)]
  }, {
    type : "CACTUS_LARGE",
    className : " cactus cactus-large ",
    width : 25,
    height : 50,
    yPos : 90,
    multipleSpeed : 6,
    minGap : 120,
    collisionBoxes : [new CollisionBox(0, 12, 7, 38), new CollisionBox(8, 0, 7, 49), new CollisionBox(13, 10, 10, 38)]
  }];
  Trex.config = {
    DROP_VELOCITY : -5,
    GRAVITY : 0.6,
    HEIGHT : 47,
    INIITAL_JUMP_VELOCITY : -10,
    INTRO_DURATION : 1500,
    MAX_JUMP_HEIGHT : 30,
    MIN_JUMP_HEIGHT : 30,
    SPEED_DROP_COEFFICIENT : 3,
    SPRITE_WIDTH : 262,
    START_X_POS : 50,
    WIDTH : 44
  };
  /** @type {!Array} */
//  Trex.collisionBoxes = [new CollisionBox(1, -1, 30, 26), new CollisionBox(32, 0, 8, 16), new CollisionBox(10, 35, 14, 8), new CollisionBox(1, 24, 29, 5), new CollisionBox(5, 30, 21, 4), new CollisionBox(9, 34, 15, 4)];
  Trex.collisionBoxes = [new CollisionBox(5, 0, 38, 47)];
  Trex.status = {
    CRASHED : "CRASHED",
    JUMPING : "JUMPING",
    RUNNING : "RUNNING",
    WAITING : "WAITING"
  };
  /** @type {number} */
  Trex.BLINK_TIMING = 7000;
  Trex.animFrames = {
    WAITING : {
      frames : [44, 0],
      msPerFrame : 1000 / 3
    },
    RUNNING : {
      frames : [88, 132],
      msPerFrame : 1000 / 12
    },
    CRASHED : {
      frames : [220],
      msPerFrame : 1000 / 60
    },
    JUMPING : {
      frames : [0],
      msPerFrame : 1000 / 60
    }
  };
  Trex.prototype = {
    init : function() {
      this.blinkDelay = this.setBlinkDelay();
      /** @type {number} */
      this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT - Runner.config.BOTTOM_PAD;
      /** @type {number} */
      this.yPos = this.groundYPos;
      /** @type {number} */
      this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
      this.draw(0, 0);
      this.update(0, Trex.status.WAITING);
    },
    setJumpVelocity : function(setting) {
      /** @type {number} */
      this.config.INIITAL_JUMP_VELOCITY = -setting;
      /** @type {number} */
      this.config.DROP_VELOCITY = -setting / 2;
    },
    update : function(deltaTime, opt_status) {
      this.timer += deltaTime;
      if (opt_status) {
        /** @type {!Object} */
        this.status = opt_status;
        /** @type {number} */
        this.currentFrame = 0;
        this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
        this.currentAnimFrames = Trex.animFrames[opt_status].frames;
        if (opt_status == Trex.status.WAITING) {
          /** @type {number} */
          this.animStartTime = performance.now();
          this.setBlinkDelay();
        }
      }
      if (this.playingIntro && this.xPos < this.config.START_X_POS) {
        this.xPos += Math.round(this.config.START_X_POS / this.config.INTRO_DURATION * deltaTime);
      }
      if (this.status == Trex.status.WAITING) {
        this.blink(performance.now());
      } else {
        this.draw(this.currentAnimFrames[this.currentFrame], 0);
      }
      if (this.timer >= this.msPerFrame) {
        this.currentFrame = this.currentFrame == this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
        /** @type {number} */
        this.timer = 0;
      }
    },
    draw : function(x, y) {
      /** @type {number} */
      var sourceX = x;
      /** @type {number} */
      var sourceY = y;
      var sourceWidth = this.config.WIDTH;
      var sourceHeight = this.config.HEIGHT;
      if (IS_HIDPI) {
        /** @type {number} */
        sourceX = sourceX * 2;
        /** @type {number} */
        sourceY = sourceY * 2;
        /** @type {number} */
        sourceWidth = sourceWidth * 2;
        /** @type {number} */
        sourceHeight = sourceHeight * 2;
      }
      this.canvasCtx.drawImage(this.image, sourceX, sourceY, sourceWidth, sourceHeight, this.xPos, this.yPos, this.config.WIDTH, this.config.HEIGHT);
    },
    setBlinkDelay : function() {
      /** @type {number} */
      this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
    },
    blink : function(time) {
      /** @type {number} */
      var deltaTime = time - this.animStartTime;
      if (deltaTime >= this.blinkDelay) {
        this.draw(this.currentAnimFrames[this.currentFrame], 0);
        if (this.currentFrame == 1) {
          this.setBlinkDelay();
          /** @type {number} */
          this.animStartTime = time;
        }
      }
    },
    startJump : function() {
      if (!this.jumping) {
        this.update(0, Trex.status.JUMPING);
        this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY;
        /** @type {boolean} */
        this.jumping = true;
        /** @type {boolean} */
        this.reachedMinHeight = false;
        /** @type {boolean} */
        this.speedDrop = false;
      }
    },
    endJump : function() {
      if (this.reachedMinHeight && this.jumpVelocity < this.config.DROP_VELOCITY) {
        this.jumpVelocity = this.config.DROP_VELOCITY;
      }
    },
    updateJump : function(deltaTime) {
      var msPerFrame = Trex.animFrames[this.status].msPerFrame;
      /** @type {number} */
      var framesElapsed = deltaTime / msPerFrame;
      if (this.speedDrop) {
        this.yPos += Math.round(this.jumpVelocity * this.config.SPEED_DROP_COEFFICIENT * framesElapsed);
      } else {
        this.yPos += Math.round(this.jumpVelocity * framesElapsed);
      }
      this.jumpVelocity += this.config.GRAVITY * framesElapsed;
      if (this.yPos < this.minJumpHeight || this.speedDrop) {
        /** @type {boolean} */
        this.reachedMinHeight = true;
      }
      if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
        this.endJump();
      }
      if (this.yPos > this.groundYPos) {
        this.reset();
        this.jumpCount++;
      }
      this.update(deltaTime);
    },
    setSpeedDrop : function() {
      /** @type {boolean} */
      this.speedDrop = true;
      /** @type {number} */
      this.jumpVelocity = 1;
    },
    reset : function() {
      this.yPos = this.groundYPos;
      /** @type {number} */
      this.jumpVelocity = 0;
      /** @type {boolean} */
      this.jumping = false;
      this.update(0, Trex.status.RUNNING);
      /** @type {boolean} */
      this.midair = false;
      /** @type {boolean} */
      this.speedDrop = false;
      /** @type {number} */
      this.jumpCount = 0;
    }
  };
  DistanceMeter.dimensions = {
    WIDTH : 10,
    HEIGHT : 13,
    DEST_WIDTH : 11
  };
  /** @type {!Array} */
  DistanceMeter.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];
  DistanceMeter.config = {
    MAX_DISTANCE_UNITS : 5,
    ACHIEVEMENT_DISTANCE : 100,
    COEFFICIENT : 0.025,
    FLASH_DURATION : 1000 / 4,
    FLASH_ITERATIONS : 3
  };
  DistanceMeter.prototype = {
    init : function(width) {
      /** @type {string} */
      var maxDistanceStr = "";
      this.calcXPos(width);
      this.maxScore = this.config.MAX_DISTANCE_UNITS;
      /** @type {number} */
      var i = 0;
      for (; i < this.config.MAX_DISTANCE_UNITS; i++) {
        this.draw(i, 0);
        this.defaultString += "0";
        /** @type {string} */
        maxDistanceStr = maxDistanceStr + "9";
      }
      /** @type {number} */
      this.maxScore = parseInt(maxDistanceStr);
    },
    calcXPos : function(canvasWidth) {
      /** @type {number} */
      this.x = canvasWidth - DistanceMeter.dimensions.DEST_WIDTH * (this.config.MAX_DISTANCE_UNITS + 1);
    },
    draw : function(digitPos, value, opt_highScore) {
      /** @type {number} */
      var sourceWidth = DistanceMeter.dimensions.WIDTH;
      /** @type {number} */
      var sourceHeight = DistanceMeter.dimensions.HEIGHT;
      /** @type {number} */
      var sourceX = DistanceMeter.dimensions.WIDTH * value;
      /** @type {number} */
      var targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
      var targetY = this.y;
      /** @type {number} */
      var targetWidth = DistanceMeter.dimensions.WIDTH;
      /** @type {number} */
      var targetHeight = DistanceMeter.dimensions.HEIGHT;
      if (IS_HIDPI) {
        /** @type {number} */
        sourceWidth = sourceWidth * 2;
        /** @type {number} */
        sourceHeight = sourceHeight * 2;
        /** @type {number} */
        sourceX = sourceX * 2;
      }
      this.canvasCtx.save();
      if (opt_highScore) {
        /** @type {number} */
        var highScoreX = this.x - this.config.MAX_DISTANCE_UNITS * 2 * DistanceMeter.dimensions.WIDTH;
        this.canvasCtx.translate(highScoreX, this.y);
      } else {
        this.canvasCtx.translate(this.x, this.y);
      }
      this.canvasCtx.drawImage(this.image, sourceX, 0, sourceWidth, sourceHeight, targetX, targetY, targetWidth, targetHeight);
      this.canvasCtx.restore();
    },
    getActualDistance : function(distance) {
      return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
    },
    update : function(deltaTime, distance) {
      /** @type {boolean} */
      var paint = true;
      /** @type {boolean} */
      var willSplash = false;
      if (!this.acheivement) {
        distance = this.getActualDistance(distance);
        if (distance > 0) {
          if (distance % this.config.ACHIEVEMENT_DISTANCE == 0) {
            /** @type {boolean} */
            this.acheivement = true;
            /** @type {number} */
            this.flashTimer = 0;
            /** @type {boolean} */
            willSplash = true;
          }
          var distanceStr = (this.defaultString + distance).substr(-this.config.MAX_DISTANCE_UNITS);
          this.digits = distanceStr.split("");
        } else {
          this.digits = this.defaultString.split("");
        }
      } else {
        if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
          this.flashTimer += deltaTime;
          if (this.flashTimer < this.config.FLASH_DURATION) {
            /** @type {boolean} */
            paint = false;
          } else {
            if (this.flashTimer > this.config.FLASH_DURATION * 2) {
              /** @type {number} */
              this.flashTimer = 0;
              this.flashIterations++;
            }
          }
        } else {
          /** @type {boolean} */
          this.acheivement = false;
          /** @type {number} */
          this.flashIterations = 0;
          /** @type {number} */
          this.flashTimer = 0;
        }
      }
      if (paint) {
        /** @type {number} */
        var i = this.digits.length - 1;
        for (; i >= 0; i--) {
          this.draw(i, parseInt(this.digits[i]));
        }
      }
      this.drawHighScore();
      return willSplash;
    },
    drawHighScore : function() {
      this.canvasCtx.save();
      /** @type {number} */
      this.canvasCtx.globalAlpha = .8;
      /** @type {number} */
      var i = this.highScore.length - 1;
      for (; i >= 0; i--) {
        this.draw(i, parseInt(this.highScore[i], 10), true);
      }
      this.canvasCtx.restore();
    },
    setHighScore : function(distance) {
      distance = this.getActualDistance(distance);
      var highScoreStr = (this.defaultString + distance).substr(-this.config.MAX_DISTANCE_UNITS);
      /** @type {!Array<?>} */
      this.highScore = ["10", "11", ""].concat(highScoreStr.split(""));
    },
    reset : function() {
      this.update(0);
      /** @type {boolean} */
      this.acheivement = false;
    }
  };
  Cloud.config = {
    HEIGHT : 13,
    MAX_CLOUD_GAP : 400,
    MAX_SKY_LEVEL : 30,
    MIN_CLOUD_GAP : 100,
    MIN_SKY_LEVEL : 71,
    WIDTH : 46
  };
  Cloud.prototype = {
    init : function() {
      this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL, Cloud.config.MIN_SKY_LEVEL);
      this.draw();
    },
    draw : function() {
      this.canvasCtx.save();
      /** @type {number} */
      var sourceWidth = Cloud.config.WIDTH;
      /** @type {number} */
      var sourceHeight = Cloud.config.HEIGHT;
      if (IS_HIDPI) {
        /** @type {number} */
        sourceWidth = sourceWidth * 2;
        /** @type {number} */
        sourceHeight = sourceHeight * 2;
      }
      this.canvasCtx.drawImage(this.image, 0, 0, sourceWidth, sourceHeight, this.xPos, this.yPos, Cloud.config.WIDTH, Cloud.config.HEIGHT);
      this.canvasCtx.restore();
    },
    update : function(speed) {
      if (!this.remove) {
        this.xPos -= Math.ceil(speed);
        this.draw();
        if (!this.isVisible()) {
          /** @type {boolean} */
          this.remove = true;
        }
      }
    },
    isVisible : function() {
      return this.xPos + Cloud.config.WIDTH > 0;
    }
  };
  HorizonLine.dimensions = {
    WIDTH : 600,
    HEIGHT : 12,
    YPOS : 127
  };
  HorizonLine.prototype = {
    setSourceDimensions : function() {
      var dimension;
      for (dimension in HorizonLine.dimensions) {
        if (IS_HIDPI) {
          if (dimension != "YPOS") {
            /** @type {number} */
            this.sourceDimensions[dimension] = HorizonLine.dimensions[dimension] * 2;
          }
        } else {
          this.sourceDimensions[dimension] = HorizonLine.dimensions[dimension];
        }
        this.dimensions[dimension] = HorizonLine.dimensions[dimension];
      }
      /** @type {!Array} */
      this.xPos = [0, HorizonLine.dimensions.WIDTH];
      /** @type {number} */
      this.yPos = HorizonLine.dimensions.YPOS;
    },
    getRandomType : function() {
      return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
    },
    draw : function() {
      this.canvasCtx.drawImage(this.image, this.sourceXPos[0], 0, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[0], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT);
      this.canvasCtx.drawImage(this.image, this.sourceXPos[1], 0, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[1], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT);
    },
    updateXPos : function(pos, increment) {
      /** @type {number} */
      var line1 = pos;
      /** @type {number} */
      var line2 = pos == 0 ? 1 : 0;
      this.xPos[line1] -= increment;
      this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;
      if (this.xPos[line1] <= -this.dimensions.WIDTH) {
        this.xPos[line1] += this.dimensions.WIDTH * 2;
        /** @type {number} */
        this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
        this.sourceXPos[line1] = this.getRandomType();
      }
    },
    update : function(deltaTime, speed) {
      /** @type {number} */
      var increment = Math.floor(speed * (FPS / 1000) * deltaTime);
      if (this.xPos[0] <= 0) {
        this.updateXPos(0, increment);
      } else {
        this.updateXPos(1, increment);
      }
      this.draw();
    },
    reset : function() {
      /** @type {number} */
      this.xPos[0] = 0;
      /** @type {number} */
      this.xPos[1] = HorizonLine.dimensions.WIDTH;
    }
  };
  Horizon.config = {
    BG_CLOUD_SPEED : 0.2,
    BUMPY_THRESHOLD : .3,
    CLOUD_FREQUENCY : .5,
    HORIZON_HEIGHT : 16,
    MAX_CLOUDS : 6
  };
  Horizon.prototype = {
    init : function() {
      this.addCloud();
      this.horizonLine = new HorizonLine(this.canvas, this.horizonImg);
    },
    update : function(deltaTime, currentSpeed, updateObstacles) {
      this.runningTime += deltaTime;
      this.horizonLine.update(deltaTime, currentSpeed);
      this.updateClouds(deltaTime, currentSpeed);
      if (updateObstacles) {
        this.updateObstacles(deltaTime, currentSpeed);
      }
    },
    updateClouds : function(deltaTime, speed) {
      /** @type {number} */
      var cloudSpeed = this.cloudSpeed / 1000 * deltaTime * speed;
      var numClouds = this.clouds.length;
      if (numClouds) {
        /** @type {number} */
        var i = numClouds - 1;
        for (; i >= 0; i--) {
          this.clouds[i].update(cloudSpeed);
        }
        var lastCloud = this.clouds[numClouds - 1];
        if (numClouds < this.config.MAX_CLOUDS && this.dimensions.WIDTH - lastCloud.xPos > lastCloud.cloudGap && this.cloudFrequency > Math.random()) {
          this.addCloud();
        }
        this.clouds = this.clouds.filter(function(inventoryService) {
          return !inventoryService.remove;
        });
      }
    },
    updateObstacles : function(deltaTime, currentSpeed) {
      var updatedObstacles = this.obstacles.slice(0);
      /** @type {number} */
      var i = 0;
      for (; i < this.obstacles.length; i++) {
        var obstacle = this.obstacles[i];
        obstacle.update(deltaTime, currentSpeed);
        if (obstacle.remove) {
          updatedObstacles.shift();
        }
      }
      this.obstacles = updatedObstacles;
      if (this.obstacles.length > 0) {
        var lastObstacle = this.obstacles[this.obstacles.length - 1];
        if (lastObstacle && !lastObstacle.followingObstacleCreated && lastObstacle.isVisible() && lastObstacle.xPos + lastObstacle.width + lastObstacle.gap < this.dimensions.WIDTH) {
          this.addNewObstacle(currentSpeed);
          /** @type {boolean} */
          lastObstacle.followingObstacleCreated = true;
        }
      } else {
        this.addNewObstacle(currentSpeed);
      }
    },
    addNewObstacle : function(currentSpeed) {
      var obstacleTypeIndex = getRandomNum(0, Obstacle.types.length - 1);
      var obstacleType = Obstacle.types[obstacleTypeIndex];
      var obstacleImg = this.obstacleImgs[obstacleType.type];
      this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType, obstacleImg, this.dimensions, this.gapCoefficient, currentSpeed));
    },
    reset : function() {
      /** @type {!Array} */
      this.obstacles = [];
      this.horizonLine.reset();
    },
    resize : function(width, height) {
      /** @type {number} */
      this.canvas.width = width;
      /** @type {number} */
      this.canvas.height = height;
    },
    addCloud : function() {
      this.clouds.push(new Cloud(this.canvas, this.cloudImg, this.dimensions.WIDTH));
    }
  };
})();
new Runner(".interstitial-wrapper");

