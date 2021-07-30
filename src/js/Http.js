const jsdom = require('jsdom')
const { JSDOM } = jsdom;
const { document } = (new JSDOM('<!doctype html><html><body></body></html>')).window;
global.document = document;
const window = document.defaultView;
const $ = require('jquery')(window);

var _token = ""

function getFrameVersion(callback) {
    console.log('获取框架版本...');
    $.get({
        url: 'https://hotupdateapi.xq5.com/v3/platform_patches',
        data: {
            game_id: 96
        },
        async: false,
        headers: {
            'x-xq5-jwt': _token,
            'Content-Type': 'application/json; charset=utf-8'
        },
        success: function (result) {
            if (result.errno == "0") {
                callback && callback(result.data[0]);
            }
            console.log(result.errmsg);
        }
    })
}

function login(login_name, login_password, callback) {
    console.log('登录中...');
    $.post({
        url: 'http://login.xq5.com/api/v1/zonst/login',
        data: {
            login_name: login_name,
            login_password: login_password,
        },
        success: function (data) {
            // 输错密码或者密码被锁定
            if (Number(data.errno) === -1) {
                console.log(data.errmsg);
                return
            }
            // 密码超过90天未修改
            if (Number(data.errno) === 1) {
                console.log(data.errmsg + '  请立即修改密码');
                return
            }
            // 正常登录
            if (Number(data.errno) === 0) {
                _token = data.token;
                callback && callback(data.token);
            }
        },
    })
}

module.exports = {
    login,
    getFrameVersion
}