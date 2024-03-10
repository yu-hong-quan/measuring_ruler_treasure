// var startX, startY, endX, endY, lines;
// 定义一个节流函数
function throttle(func, delay) {
  let timer = null;
  return function () {
    if (!timer) {
      timer = setTimeout(() => {
        func.apply(this, arguments);
        timer = null;
      }, delay);
    }
  };
}

// 获取当前年月日时分秒
function getNewDate() {
  const now = new Date(); // 获取当前日期和时间
  const year = now.getFullYear(); // 获取当前年份
  const month = now.getMonth() + 1; // 获取当前月份（注意：JavaScript 中的月份从 0 开始）
  const date = now.getDate(); // 获取当前日期
  const hour = now.getHours(); // 获取当前小时数
  const minute = now.getMinutes(); // 获取当前分钟数
  const second = now.getSeconds(); // 获取当前秒数
  return `${year}-${month}-${date} ${hour}:${minute}:${second}`
}

let scrollTop = 0;
Page({

  /**
   * 页面的初始数据
   */
  data: {
    tempFilePath: '',
    canvas: null,
    ctx: null,
    dpr: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    count: 0,
    backgroundImage: null,
    isDrawingLine: false,
    clickShape: {
      type: null,
      index: null
    },
    clickedLine: null,
    currentLine: null,
    drawList: [],
    lines: [],
    tags: [],
    chicunValue: '',
    alertBoxVisible: false,
    operationType: 'line',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

    let self = this;
    if (options.tempFilePath) {
      wx.showLoading({
        title: '加载中...',
      })
      let url = decodeURIComponent(options.tempFilePath);
      const fs = wx.getFileSystemManager();
      let filePath = 'data:image/jpg;base64,' + fs.readFileSync(url, 'base64')
      let times = new Date().getTime();
      let codeimg = wx.env.USER_DATA_PATH + '/' + times + '.png';
      fs.writeFile({
        filePath: codeimg,
        data: filePath.slice(22),
        encoding: 'base64',
        success: (res) => {
          wx.getImageInfo({
            src: codeimg,
            success: res => {
              self.setData({
                tempFilePath: codeimg,
                canvasWidth: res.width,
                canvasHeight: res.height,
              },() => {
                self.readyCanvas()
              })
            }
          })
        }
      })
    }
  },

  onPageScroll(e){
    scrollTop = e.scrollTop
  },

  taging(){
    let self = this;
    self.setData({
      operationType: 'tag'
    })
  },

  lining(){
    let self = this;
    self.setData({
      operationType: 'line'
    })
  },

  // 初始化画板
  readyCanvas() {
    let self = this;
    const query = wx.createSelectorQuery()
    query.select('#myCanvas').boundingClientRect((rect) => {
      this.setData({
        canvasRect: rect,
      })
    })
    query.select('#myCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[1].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        // 绘制底图
        let bg = canvas.createImage();
        bg.src = self.data.tempFilePath;
        bg.onload = function () {
          ctx.drawImage(bg, 0, 0, canvas.width, canvas.height)
          wx.hideLoading()
        }

        self.setData({
          canvas,
          ctx,
          dpr,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          backgroundImage: bg
        })


        this.drawCanvas()
      })
  },

  // 手指触摸事件
  eventHandleStart(e) {
    const { dpr, drawList, operationType } = this.data
    var mouseX = e.touches[0].x * dpr
    var mouseY = e.touches[0].y * dpr
    if (operationType == 'line') {
      if (this.isInsideShape({ mouseX, mouseY }, false)) {
        return
      }
      drawList.push({
        startX: mouseX,
        startY: mouseY,
        endX: mouseX,
        endY: mouseY,
        text: '输入尺寸',
        type: 'line'
      });
      this.setData({
        isDrawingLine: true,
        startX: mouseX,
        startY: mouseY,
      })
    }
  },

  eventHandleMove: throttle(function (e) {
    this.setData({
      count: this.data.count + 1
    })
    const { canvas, ctx, drawList, dpr, canvasRect, isDrawingLine } = this.data
    var mouseX = e.touches[0].clientX * dpr - canvasRect.left * dpr;
    var mouseY = (e.touches[0].clientY * dpr) - (canvasRect.top * dpr) + (scrollTop * dpr);
    let currentLine = null
    if (!isDrawingLine) return;
    if (isDrawingLine) {
      currentLine = drawList[drawList.length - 1];
      currentLine.endX = mouseX;
      currentLine.endY = mouseY;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawCanvas();
    }
    this.data.currentLine = currentLine
  }, 16),

  // 手指触摸结束时的事件
  eventHandleEnd(e) {
    let { drawList } = this.data;
    const shape = drawList[drawList.length - 1]
    if (shape && shape.type === 'line') {
      if (this.detectionLength(shape) > 25) {
        if (shape.text == '输入尺寸') {
          this.data.clickedLine = drawList.length - 1
          this.setData({
            alertBoxVisible: true
          })
        }
      } else {
        drawList.pop()
      }
      this.data.isDrawingLine = false
    }

    this.drawCanvas()
  },

  // 点击添加标签
  eventHandleTap(e) {
    const { dpr, canvasRect, drawList, operationType } = this.data
    var mouseX = e.touches[0].clientX * dpr - canvasRect.left * dpr
    var mouseY = (e.touches[0].clientY * dpr) - (canvasRect.top * dpr) + (scrollTop * dpr)
    if (this.isInsideShape({ mouseX, mouseY })) {
      return
    }

    if (operationType === 'tag') {
      drawList.push({
        startX: mouseX,
        startY: mouseY,
        text: '请输入标签文本',
        type: 'tag'
      });
      this.drawCanvas()
    }
  },
  isInsideShape({ mouseX, mouseY }, openModal = true) {
    const { drawList } = this.data
    for (var i = drawList.length - 1; i >= 0; i--) {
      const item = drawList[i]
      if (item.type === 'line' && this.isInsideLine(mouseX, mouseY, item)) {
        openModal && this.setData({
          alertBoxVisible: true,
          clickedLine: i
        })
        return item;
      } else if (item.type === 'tag' && this.isInsideTag(mouseX, mouseY, item)) {
        openModal && this.setData({
          alertBoxVisible: true,
          clickedLine: i
        })
        return item;
      }

    }
    return null
  },
  // 长度
  detectionLength(line) {
    if (!line) return 0
    const { startX, startY, endX, endY } = line
    return Math.max(Math.abs(startX - endX), Math.abs(startY - endY))
  },
  // 清除画布
  clearCanvas() {
    this.data.drawList.pop()
    this.drawCanvas()
  },
  // 画图
  drawCanvas() {
    let { ctx, canvasWidth, canvasHeight, backgroundImage } = this.data;
    if (!backgroundImage) return
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
    this.drawShapes()
  },

  // 绘制线
  drawLineOld({ startX, startY, endX, endY, text }) {
    const { ctx, dpr } = this.data
    const color = "yellow";
    const fontSize = 13 * dpr;
    ctx.font = fontSize + "px SourceHanSerifCN";
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = color
    ctx.fillStyle = color

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // 计算箭头的角度和长度
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 8 * dpr;
    // 绘制箭头的两个侧边
    // 侧边1
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLength * Math.cos(angle - Math.PI / 6), endY - arrowLength * Math.sin(angle - Math.PI / 6));
    ctx.stroke();
    // 侧边2
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLength * Math.cos(angle + Math.PI / 6), endY - arrowLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();

    // 放置文本
    const textWidth = ctx.measureText(text).width;
    const middleX = (startX + endX) / 2;
    const middleY = (startY + endY) / 2;

    // 保存当前状态
    ctx.save();
    // 移动坐标原点到中心点
    ctx.translate(middleX, middleY);
    // 计算斜线段的角度
    const textRotationAngle = Math.atan2(endY - startY, endX - startX)
    // 再旋转一个相反的角度
    ctx.rotate(textRotationAngle);
    if (startX - endX > 0) {
      ctx.scale(1, -1);
      ctx.scale(-1, 1);
    }

    // 将文本放置在中心点
    ctx.fillText(text, -textWidth / 2, - 10);
    // 恢复绘图状态
    ctx.restore();
  },
  getLineLength({startX, startY, endX, endY}){
    return Math.sqrt(Math.pow(endX - startX,2) + Math.pow(endY - startY,2));
  },
  getLineAngle({startX, startY, endX, endY}){
    let angle = Math.atan2(endY - startY, endX - startX);
    let cosAngle = Math.cos(angle);
    let sinAngle = Math.sin(angle);
    return {
      angle,
      cosAngle,
      sinAngle
    }
  },
  drawVerticalLines(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1 - 5, y1);
    ctx.lineTo(x1 - 5, y1 - 10);
    ctx.moveTo(x2 - 5, y2);
    ctx.lineTo(x2 - 5, y2 - 10);
    ctx.stroke();
  },
  calcLineCoord({startX, startY, endX, endY, centerGap}){
    // 计算线段长度
    let length = this.getLineLength({startX, startY, endX, endY})
    const {cosAngle, sinAngle} = this.getLineAngle({startX, startY, endX, endY})

    // 计算间隔距离
    // 间隔距离超过线段长度，不添加间隔
    let gapLength = centerGap <= length ? centerGap : 0;
    let totalLength = length - gapLength; // 总长度减去文字
    // 第一条线结束坐标
    let line1EndX = startX + (totalLength * cosAngle) / 2;
    let line1EndY = startY + (totalLength * sinAngle) / 2;
    // 第二条线段的开始下标
    let line2StartX = line1EndX + (gapLength * cosAngle);
    let line2StartY = line1EndY + (gapLength * sinAngle);

    return [
      {
        startX,
        startY,
        endX: line1EndX,
        endY: line1EndY
      },
      {
        startX: line2StartX,
        startY: line2StartY,
        endX,
        endY,
      }
    ]
  },
  drawLineRound(x,y,radius){
    const { ctx, dpr } = this.data
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.arc(x,y, radius, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.stroke();
  },
  drawInitialLine({x, y, lineLength, rotationAngle}){
    const { ctx } = this.data
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.PI / 2) + rotationAngle);
    ctx.beginPath();
    ctx.moveTo(-lineLength, 0);
    ctx.lineTo(lineLength, 0);
    ctx.stroke();
    ctx.restore();
  },
  drawLine({ startX, startY, endX, endY, text }) {
    const { ctx, dpr } = this.data
    const color = "white";
    const fontSize = 13 * dpr;
    const textSpacing = 10 * dpr
    // 计算需要绘制的斜线段角度
    const rotationAngle = Math.atan2(endY - startY, endX - startX)
    
    ctx.font = fontSize + "px SourceHanSerifCN";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = color
    ctx.fillStyle = color
    
    // 绘制线段------
    // 文本宽度
    const textWidth = ctx.measureText(text).width;
    const line = this.calcLineCoord({startX, startY, endX, endY,centerGap: textWidth + textSpacing})
    const line1 = line[0]
    const line2 = line[1]
    // 设置 线长和间隔 ==> 虚线
    ctx.setLineDash([5,10]);
    // 绘制第一条线段
    ctx.beginPath();
    ctx.moveTo(line1.startX, line1.startY);
    ctx.lineTo(line1.endX, line1.endY);
    ctx.stroke();
    // 绘制第二条线段
    ctx.beginPath();
    ctx.moveTo(line2.startX, line2.startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    // 设置实线绘制下面的内容
    ctx.setLineDash([0]);
    // 绘制起始、终止线段------
    const radius = 2 * dpr;
    this.drawLineRound(startX,startY, radius)
    this.drawLineRound(endX,endY, radius)

    // 绘制终止起始线-------
    const lineLength = 13 * dpr
    this.drawInitialLine({x: startX, y: startY, lineLength, rotationAngle})
    this.drawInitialLine({x: endX, y: endY, lineLength, rotationAngle})
   
    // 放置文本
    const middleX = (startX + endX) / 2;
    const middleY = (startY + endY) / 2;
   
    // 保存当前状态
    ctx.save();
    // 移动坐标原点到中心点
    ctx.translate(middleX, middleY);
    // 再旋转一个相反的角度
    ctx.rotate(rotationAngle);
    if (startX - endX > 0) {
      ctx.scale(1, -1);
      ctx.scale(-1, 1);
    }

    // 将文本放置在中心点
    ctx.fillText(text, -textWidth / 2, fontSize / 4);
    // 恢复绘图状态
    ctx.restore();
  },
  drawShapes() {
    const { drawList } = this.data
    drawList.forEach(item => {
      if (item.type === 'line') {
        this.drawLine(item)
      } else if (item.type === 'tag') {
        this.drawTag(item)
      }
    })
  },
  isInsideTag(startX, startY, tag) {
    const { x, y, width, height } = tag.boundaryBox
    return startX >= x &&
      startX <= x + width &&
      startY >= y &&
      startY <= y + height;
  },
  drawTag(tagItem) {
    const { ctx, dpr, canvasWidth } = this.data
    const { startX, startY, text } = tagItem

    ctx.save()
    ctx.translate(startX, startY)
    ctx.lineWidth = 1 * dpr;
    const opacity = .5
    const height = 20 * dpr
    const width = 120 * dpr
    // 外圆半径
    const excircleRadius = 15 * dpr / 2; //中间位置
    // 圆下标
    const roundX = 0 + (excircleRadius / 2)
    const roundY = 0
    // 圆与标签间隔
    const interval = excircleRadius / 2
    // 标签开始下标
    const tagX = roundX + excircleRadius + interval
    const tagY = roundY
    // 标签宽度 圆宽+间隔宽+标签宽度
    const totalWidth = excircleRadius + interval + width

    // 计算是否超出右边界，用于更换标签方向
    const toLeft = startX + totalWidth >= canvasWidth
    if (toLeft) {
      ctx.scale(-1, 1)
    }

    // 标签左侧角度
    const tagLeftAngle = 15 * dpr
    // 设置外圆、标签透明度和颜色
    ctx.globalAlpha = opacity
    ctx.fillStyle = 'rgba(60, 60, 60, 1)'
    // 画标签
    ctx.beginPath();
    ctx.moveTo(tagX, tagY);
    ctx.lineTo(tagX + tagLeftAngle, tagY - height / 2);
    ctx.lineTo(tagX + width, tagY - height / 2);
    ctx.lineTo(tagX + width, tagY + height / 2);
    ctx.lineTo(tagX + tagLeftAngle, tagY + height / 2);
    ctx.lineTo(tagX, tagY);
    ctx.fill();

    // 外圆
    ctx.fillStyle = 'rgba(60, 60, 60, 1)'
    ctx.beginPath();
    ctx.arc(roundX, roundY, excircleRadius, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
    // 恢复透明度，绘画内圆
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255, 255, 255, 1)'
    // 内圆
    ctx.beginPath();
    ctx.arc(roundX, roundY, excircleRadius / 2, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();

    // 文本
    // 设置文本的参数
    const fontSize = 13 * dpr;
    ctx.font = fontSize + "px SourceHanSerifCN"

    // 获取文本的宽度
    const textWidth = ctx.measureText(text).width;
    // 文本的高度
    const textHeight = fontSize;
    // 文本的 x 坐标
    const textX = tagX + (width + tagLeftAngle - textWidth) / 2;
    // 文本的 y 坐标
    const textY = tagY + (height - textHeight)/2 ;

    ctx.fillStyle = 'white';
    ctx.translate(textX, textY)

    // 翻转
    if (toLeft) {
      ctx.translate(textWidth, 0)
      ctx.scale(-1, 1)
    }

    ctx.fillText(text, 0, 0)
    ctx.restore()

    // 计算标签边界
    tagItem.boundaryBox = {
      // 翻转出起始X下标
      x: toLeft ? (startX - totalWidth) : startX,
      y: startY - height / 2,
      width: totalWidth,
      height: height,
    }
  },

  isInsideLine(x, y, line) {
    const { dpr } = this.data
    var tolerance = 10 * dpr; // 点击判断的容差值
    // 计算线段的方向向量
    var dx = line.endX - line.startX;
    var dy = line.endY - line.startY;
    // 计算线段的长度
    var length = Math.sqrt(dx * dx + dy * dy);
    // 将方向向量单位化
    var unitDX = dx / length;
    var unitDY = dy / length;
    // 计算垂直于线段的单位法向量
    var normalDX = -unitDY;
    var normalDY = unitDX;
    // 计算起点、终点偏移容差
    var offset = tolerance / 2;
    // 计算点到起点的向量
    var pointDX = x - line.startX;
    var pointDY = y - line.startY;
    // 计算点到起点的投影长度
    var projection = pointDX * unitDX + pointDY * unitDY;
    // 如果投影在线段范围内
    if (projection >= -offset && projection <= length + offset) {
      // 计算点到线段的距离
      var distance = pointDX * normalDX + pointDY * normalDY;
      return Math.abs(distance) <= tolerance;
    }
    return false;
  },

  // 绘制水印logo
  drawWatermarkLogo(callBack) {
    this.drawCanvas()
    let { ctx, canvas, canvasWidth, canvasHeight,dpr } = this.data;
    const fs = wx.getFileSystemManager();
    let filePath = 'data:image/jpg;base64,' + fs.readFileSync('/images/mark.png', 'base64')
    let times = new Date().getTime();
    let logoimg = wx.env.USER_DATA_PATH + '/' + times + '.png';
    fs.writeFile({
      filePath: logoimg,
      data: filePath.slice(22),
      encoding: 'base64',
      success: (res) => {
        wx.getImageInfo({
          src: logoimg,
          success: res => {
            console.log(res.path);
            let bg = canvas.createImage();
            console.log(bg);
            bg.src = logoimg;
            bg.onload = ()=> {
              ctx.drawImage(bg, canvasWidth - 100 * dpr, canvasHeight - 48 * dpr, 300, 100);
              this.drawWatermarkName()
              callBack()
            }
          }
        })
      }
    })
  },
  // 绘制水印名称及当前时间
  drawWatermarkName() {
    let { ctx, canvasWidth, canvasHeight, dpr } = this.data;
    let fontSize = 18 * dpr;
    ctx.font = fontSize + "px SourceHanSerifCN";
    ctx.fillStyle = '#000'
    // const title = '水豚先生'
    // const titleWidth = ctx.measureText(title).width;
    // ctx.fillText(title, canvasWidth - titleWidth - 10 * dpr, canvasHeight - 35 * dpr);
    fontSize = 11 * dpr;
    ctx.font = fontSize + "px SourceHanSerifCN";

    const timeWidth = ctx.measureText(getNewDate()).width;
    ctx.fillText(getNewDate(), canvasWidth - timeWidth - 9 * dpr , canvasHeight - 5 * dpr);
    ctx.restore()
  },

  // 保存
  saveImage() {
    let { canvas } = this.data;
    wx.showLoading({
      title: '保存中...',
      mask: true
    })
    this.drawWatermarkLogo(()=>{
      const fs = wx.getFileSystemManager();
      let filePath = canvas.toDataURL()
      let times = new Date().getTime();
      let logoimg = wx.env.USER_DATA_PATH + '/' + times + '.png';
      fs.writeFile({
        filePath: logoimg,
        data: filePath.slice(22),
        encoding: 'base64',
        success: (res) => {
          wx.getImageInfo({
            src: logoimg,
            success: res => {
            wx.hideLoading()
            wx.saveImageToPhotosAlbum({
                filePath: logoimg,
                success(res) {
                  console.log('res', res);
                  wx.showToast({
                    title: '已保存到相册',
                    icon: 'success',
                    duration: 3000
                  })
                  setTimeout(()=>{
                    wx.navigateBack()
                  },1000)
                },fail(err){
                  console.log(err);
                  if (err.errMsg == 'saveImageToPhotosAlbum:fail auth deny') {
                    // 用户拒绝了授权，再次请求授权
                    wx.showModal({
                      title: '提示',
                      content: '请允许使用相册功能，否则无法保存图片到相册',
                      success: function(res) {
                        if (res.confirm) {
                          wx.openSetting({
                            success: function(res) {
                              if (res.authSetting['scope.writePhotosAlbum']) {
                                // 用户已经同意授权，再次保存图片
                                wx.saveImageToPhotosAlbum({
                                  filePath: logoimg,
                                  success: function() {
                                    wx.showToast({
                                      title: '已保存到相册',
                                      icon: 'success'
                                    });
                                  }
                                });
                              }
                            }
                          });
                        }
                      }
                    });
                  } else {
                    wx.showToast({
                      title: '保存失败',
                      icon: 'none'
                    });
                    wx.hideLoading()
                  }
                }
              })
            }
          })
        },fail(){
          wx.hideLoading()
        }
      })
    })
  },

  handleInputChange(e) {
    this.setData({
      chicunValue: e.detail.value
    })
  },
  cancleAlertBox() {
    this.setData({
      alertBoxVisible: false,
      chicunValue: ''
    })
  },
  confmitAlertBox() {
    const { clickedLine, chicunValue, drawList } = this.data
    drawList[clickedLine].text = chicunValue.trim()
    this.setData({
      alertBoxVisible: false,
      chicunValue: ''
    })
    this.drawCanvas()
  },
  switchTab() {
    this.setData({
      operationType: this.data.operationType === 'tag' ? 'line' : 'tag'
    })
  }
})