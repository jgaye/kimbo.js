(function(){var n,o,a;o=$("#nav"),n=$("#iframe"),a=(window.location.hash?$(window.location.hash):o.find("a").first()).addClass("current").attr("href"),n.on("load",function(){var o;return console.log("load $iframe"),o=n.contents().find("#bs-chart-frame"),o.on("load",function(){return console.log("load $chartIframe"),o.contents().find("body").css({background:"#fff",padding:"0px",margin:"0px"})})}),n.attr("src",a),o.on("click","a",function(){return $(this).addClass("current").parent().siblings().find("a").removeClass("current"),window.location.hash="#"+this.id,$("#iframe").on("load",function(){return console.log("loaded")})})}).call(this);