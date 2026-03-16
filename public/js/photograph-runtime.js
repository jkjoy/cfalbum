(function () {
  window.Photograph = window.Photograph || {};

  var cfg = window.__siteConfig || {};
  var lazyPlaceholder = String(cfg.lazyImg || '/src/lazy.svg');

  function mapFancyButtons(opts) {
    var map = {
      fb3_zoom: 'zoom',
      fb3_share: 'share',
      fb3_slideShow: 'slideShow',
      fb3_fullScreen: 'fullScreen',
      fb3_download: 'download',
      fb3_thumbs: 'thumbs',
      fb3_close: 'close'
    };
    if (!Array.isArray(opts)) return ['zoom', 'slideShow', 'fullScreen', 'thumbs', 'close'];
    return opts.map(function (x) { return map[x]; }).filter(Boolean);
  }

  function initGoButtons() {
    var $goTop = $('#go-top');
    var $goBottom = $('#go-bottom');
    if (!$goTop.length || !$goBottom.length) return;

    $goTop.hide();
    $goBottom.hide();

    $(window).off('scroll.goTop').on('scroll.goTop', function () {
      var top = $(this).scrollTop();
      var nearBottom = top > (document.body.scrollHeight - window.innerHeight - 120);
      if (top > 100) $goTop.fadeIn(); else $goTop.fadeOut();
      if (nearBottom) $goBottom.fadeOut(); else $goBottom.fadeIn();
    }).trigger('scroll.goTop');

    $goTop.off('click').on('click', function () { $('html,body').animate({ scrollTop: 0 }, 300); return false; });
    $goBottom.off('click').on('click', function () { $('html,body').animate({ scrollTop: document.body.scrollHeight }, 300); return false; });
  }

  function initLazyMasonry() {
    $('img.lazy').lazyload({
      placeholder: lazyPlaceholder,
      effect: 'fadeIn',
      load: function () {
        if (!$('#masonry').length) return;
        var $container = $('#masonry');
        var selector = $('.post-item').length ? '.post-item' : ($('.item').length ? '.item' : '');
        if (!selector) return;
        $container.imagesLoaded(function () {
          $container.masonry({ itemSelector: selector, gutter: 0, isAnimated: false });
        });
      }
    });
  }

  function initFancybox() {
    if (!$('[data-fancybox="gallery"]').length) return;
    var buttons = mapFancyButtons(cfg.fancyBox3Opt);
    $('[data-fancybox="gallery"]').fancybox({
      toolbar: true,
      loop: false,
      smallBtn: false,
      buttons: buttons,
      iframe: { preload: false }
    });
  }

  function initInfiniteScroll() {
    if (!cfg.infiniteScroll) return;
    if (!$('a').is('ol.page-navigator li.next a') || !$('#masonry').length || $('.item').length === 0) return;

    var $grid = $('#masonry').masonry({ itemSelector: '.item', gutter: 0, isAnimated: false });
    var msnry = $grid.data('masonry');
    $grid.infiniteScroll({
      path: 'ol.page-navigator li.next a',
      append: '#masonry div.item',
      hideNav: 'ol.page-navigator',
      history: false,
      prefill: true,
      outlayer: msnry
    });
    $grid.on('append.infiniteScroll', function () { $('img.lazy').lazyload(); });
    $grid.on('last.infiniteScroll', function () { $('#no-data').html('<div>😋已经到底啦！</div>'); });
  }

  function initRandomPost() {
    window.Photograph.randomPool = Array.isArray(cfg.randomPool) ? cfg.randomPool : (Array.isArray(window.__randomPool) ? window.__randomPool : []);
    window.Photograph.goRandomPost = function () {
      if (!window.Photograph.randomPool.length) return;
      var idx = Math.floor(Math.random() * window.Photograph.randomPool.length);
      location.href = window.Photograph.randomPool[idx];
    };
    $('#go-random').off('click').on('click', function (e) {
      e.preventDefault();
      window.Photograph.goRandomPost();
    });
    if (location.hash === '#random') window.Photograph.goRandomPost();
  }

  function initQrcode() {
    if (cfg.enableQrcode === false) return;
    if (typeof AraleQRCode === 'undefined') return;
    if ($('#qrcode').length) return;

    var qrcodeDiv = $('<div id="qrcode"></div>');
    var qrnode = new AraleQRCode({ render: 'canvas', correctLevel: 1, text: window.location.href, size: 100, background: '#fff', foreground: '#000', pdground: '#55F' });
    var qrcodeImg = new Image();
    qrcodeImg.src = qrnode.toDataURL('image/png');
    qrcodeDiv.html(qrcodeImg);
    $('body').append(qrcodeDiv);

    window.Photograph.showQrcode = function () { $('#qrcode').css('display', 'block'); };
    window.Photograph.hideQrcode = function () { $('#qrcode').css('display', 'none'); };

    $('#qrcode').off('click').on('click', function () { window.Photograph.hideQrcode(); });
    $('#show-qrcode').off('click').on('click', function (e) { e.preventDefault(); window.Photograph.showQrcode(); });
  }

  function initHotKeys() {
    if (!cfg.hotKeys || typeof shortcut === 'undefined') return;
    shortcut.add('j', function () { $('html,body').animate({ scrollTop: $(window).scrollTop() + 200 }, 120); }, {
      type: 'keydown', propagate: false, disable_in_input: true, target: document
    });
    shortcut.add('k', function () { $('html,body').animate({ scrollTop: Math.max(0, $(window).scrollTop() - 200) }, 120); }, {
      type: 'keydown', propagate: false, disable_in_input: true, target: document
    });
  }

  window.Photograph.initListPage = function () {
    initLazyMasonry();
    initGoButtons();
    initInfiniteScroll();
  };

  $(function () {
    if (history.length < 2) $('.header-post-back').css('opacity', 0);
    initLazyMasonry();
    initFancybox();
    initGoButtons();
    initInfiniteScroll();
    initRandomPost();
    if (cfg.enableQrcode === false) {
      $('#show-qrcode').hide();
    }
    initQrcode();
    initHotKeys();
  });
})();
