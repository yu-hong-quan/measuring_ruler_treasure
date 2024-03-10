// pages/home/home.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    tempFilePath:'',
    typeArr:['点线','贴标'],
    typeIndex:0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '水豚先生·量尺宝',
      imageUrl:'/images/bg.jpg'
    }
  },

  bindPickerChange: function(e) {
    console.log('picker发送选择改变，携带值为', e.detail.value)
    this.setData({
      typeIndex:e.detail.value
    })
    this.handleChooseMedia(e);
  },

  handleChooseMedia(e) {
    let self = this;
    let { type } = e.currentTarget.dataset;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [type],
      camera: 'back',
      success(res) {
        self.setData({
          tempFilePath:res.tempFiles[0].tempFilePath
        })
        wx.navigateTo({
          url: `/pages/canvasPage/canvasPage?tempFilePath=${encodeURIComponent(self.data.tempFilePath)}&typeIndex=${self.data.typeIndex}`,
        })
      }
    })
  },

  goCustomized() {
    wx.showToast({
      title: '功能正在制作中...',
      icon: 'none',
      duration: 1500
    })
  },
})