var activeSlideShow = false, template3 = true;

$(function () {
    textboxAdd = 160;

    if (typeof printPDF == 'undefined') {
        $("#box1,#box2,.slide-image-toolbar").hide();

        //init textbox or imageslider
        if ($("#iFieldTypeSelect").val() == "textbox") {
            $("#box-choose,#box1").toggle();
            //reset scrollbars
            setTimeout(function () {
                jQuery('.scrollable-area-wrapper').css({
                    height: ''
                })
                initAll();
                jcf.customForms.refreshAll();
            }, 100);
        }
        else if ($("#iFieldTypeSelect").val() == "imageslider") {
            $("#box-choose,#box2").toggle();
        }

        $("#box2").click(function () {
            if ($(this).hasClass("fullscreen")) {
                $(this).removeClass("fullscreen");

                $(this).find("img").each(function () {
                    $(this).css("left", "");
                    $(this).css("top", "");
                });

                $('#slider-toolbar .btn-play').trigger('click');

                $("#slider-toolbar,#slider-message").hide();

            } else {
                $(this).addClass("fullscreen");
                $("#slider-toolbar .btn-play-pause").removeClass("paused");

                $(this).find("img").each(function () {
                    $(this).css("left", $(window).width() / 2 - $(this).width() / 2);
                    $(this).css("top", $(window).height() / 2 - $(this).height() / 2);
                });

                var numberOfImagesInSlideShow = $("#box2 img:not(.img-uploader)").length;
                if (numberOfImagesInSlideShow > 1) {
                    $("#slider-toolbar").show();     
                }
            }

        });

        $("#slider-toolbar .btn-play-pause").click(function () {
            if ($(this).hasClass("paused")) {
                $(this).removeClass("paused");

                $("#slider-message").hide();
            } else {
                $(this).addClass("paused");

                $("#slider-message").show();
            }

        });
    } else {
        $(".slide-image-toolbar").hide();
        if ($("#iFieldTypeSelect").val() == "textbox") {
            $("#box1").show();
            $("#box2").hide();
        } else if ($("#iFieldTypeSelect").val() == "imageslider") {
            $("#box2").show();
            $("#box1").hide();
        }
    }
})