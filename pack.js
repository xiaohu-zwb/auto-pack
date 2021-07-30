const pack = require('./src/main/main.js');
const { readSyncByRl } = require("./src/js/readLine.js");
const os = require('os');
var sys = os.platform();
const shell = require("shelljs");

// 检测python版本，避免后续程序受到影响
let child = shell.exec("python -V");
// python2和python3的区别在于是否向主进程控制台输出版本号
if (child.toString().replace("\n", "").replace(" ", "") == "") {
    console.warn("[Python] python版本必须是3.0以上，否则将会因为版本原因导致不可预测的后果，程序终止！")
    process.exit(-1);
}
console.warn("[Python] python版本合法")

// 支持单个子游戏打包
// node pack --game NewNanChangMJ -m "南昌麻将优化" -v "1.0.10.5"

// 支持多个子游戏链式打包
// node pack --game FengChengTiPai -m "1、丰城踢牌优化\n2、手牌更新风格" -v "1.0.10.13" --game NewNanChangMJ -m "南昌麻将优化" -v "1.0.10.5"

// 支持所有子游戏全部打包
// node pack --all -m "Release11.0版本发布" -v "1.0.11.0"

// 支持手动/自动更新代码
// node pack --all -m "Release11.0版本发布" -v "1.0.11.0" --pull

// 支持绕过构建上传分包
// node pack --all -m "Release11.0版本发布" -v "1.0.11.0" --no-build

// 支持只构建代码
// node pack --all -m "Release11.0版本发布" -v "1.0.11.0" --only-build

// 支持框架热更
// node pack --framework -v 1.0.11.0 -m 新增子游戏

// 支持不上传包
// node pack --framework --no-upload

// 支持一键正式发布所有子游戏
// node pack --release --all

// 支持一键正式发布部分子游戏
// node pack --release --game NewNanChangMJ --game NewDouDiZhu

// 支持一键正式发布框架
// node pack --release --framework

var is_pack_all = false;
var pack_obj = {}
var games = [];
var is_pull = false;
var no_build = false;
var only_build = false;
var is_framework = false;
var no_upload = false;
var is_release = false;

let i = 2;
while (i < process.argv.length) {
    var arg = process.argv[i].toString().toLowerCase().trim();
    // 框架热更
    if (arg == "--framework") {
        is_framework = true;
        let j = i + 1;
        while (j < process.argv.length) {
            var arg = process.argv[j];
            if (arg == "-m") {
                pack_obj.m = process.argv[j + 1];
                j += 2;
            }
            else if (arg == "-v") {
                pack_obj.v = process.argv[j + 1];
                j += 2;
            }
            else {
                break;
            }
        }
        i = j;
    }
    else if (arg == "--all") {
        is_pack_all = true;
        let j = i + 1;
        while (j < process.argv.length) {
            var arg = process.argv[j];
            if (arg == "-m") {
                pack_obj.m = process.argv[j + 1];
                j += 2;
            }
            else if (arg == "-v") {
                pack_obj.v = process.argv[j + 1];
                j += 2;
            }
            else {
                break;
            }
        }
        i = j;
    }
    else if (arg == "--game") {
        let pack_game_obj = {
            key: process.argv[i + 1]
        }
        console.log("正在读取[--game]参数：", pack_game_obj.key);
        let j = i + 2;
        while (j < process.argv.length) {
            var arg = process.argv[j];
            if (arg == "-m") {
                pack_game_obj.m = process.argv[j + 1];
                console.log("正在读取[-m]参数：", pack_game_obj.m);
                j += 2;
            }
            else if (arg == "-v") {
                pack_game_obj.v = process.argv[j + 1];
                console.log("正在读取[-v]参数：", pack_game_obj.v);
                j += 2;
            }
            else {
                break;
            }
        }
        games.push(pack_game_obj);
        i = j;
    }
    else if (arg == "--pull") {
        console.warn("检测到有效的[--pull]参数，请确保当前分支是在master_dev\n如果是，请继续操作，否则，为了避免本地代码受到影响，将不会自动同步dev");
        is_pull = true;
        i++;
    }
    else if (arg == "--no-build") {
        console.warn("检测到有效的[--no-build]参数，这意味着你不打算构建而直接上传分包，前提是你已经构建过了，不想重复构建");
        no_build = true;
        i++;
    }
    else if (arg == "--only-build") {
        console.warn("检测到有效的[--only-build]参数，这意味着你只想构建代码，而不生成分包");
        only_build = true;
        i++;
    }
    else if (arg == "--no-upload") {
        console.warn("检测到有效的[--no-upload]参数，这意味着你只是想执行分包流程，并不想自动上传到后台");
        no_upload = true;
        i++;
    }
    else if (arg == "--release") {
        console.warn("检测到有效的[--release]参数，这意味着你打算正式发布，请谨慎操作");
        is_release = true;
        i++;
    }
    else {
        i++;
    }
}

// 开发环境
let IS_DEV = false;

// 请确保该工具直接放在工程目录下，否则此处的逻辑需要改变
let projectPath;
if (sys === 'darwin') {
    projectPath = __dirname.substring(0, __dirname.lastIndexOf('/'));
} else if (sys === 'win32') {
    projectPath = __dirname.substring(0, __dirname.lastIndexOf('\\'));
} else {
    console.log("不支持的平台：", sys);
    process.exit(-1);
}
console.warn("[ProjectPath] 请确认打包项目路径是否正确：", projectPath);

// 可选参数
var options = {
    is_release: is_release,
    is_framework: is_framework,
    is_pull: is_pull,
    no_build: no_build,
    only_build: only_build,
    no_upload: no_upload,
    is_pack_all: is_pack_all,
    pack_obj: pack_obj,
    games: games
}
console.log("[可选参数]", JSON.stringify(options));

/**
 * 主流程
 */
function __main__() {
    // 开始打包流程
    pack.start(projectPath, __dirname, options);
}

// 启动入口
(() => {
    if (IS_DEV) {
        __main__();
        return;
    }
    let tips = `即将进入热更程序 -->\n程序一旦启动将意味着项目自动化构建，分包，上传至后台并更新最新版本，是否继续？(yes/任意退出)：\n`;
    readSyncByRl(tips).then((res) => {
        if (res == "yes") {
            __main__();
        } else {
            console.log("--------------您已取消打包，程序终止！-------------------");
        }
    });
})();