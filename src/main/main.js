"use strict";

const shell = require("shelljs");
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const yaml = require('yamljs');
const os = require('os');
const sys = os.platform();
const JsZip = require('jszip');

// 网络
const Http = require('../js/Http.js');

const Root = "D:/CocosCreator";
var _token = ""
var _projectPath = "";
var _root = "";
var configData = {}
var _gameConfigs = {}
var _gameBundles = {}
var _buildPath = ""
var _sourceRoot = ""
var _options = {}
var _frameworkConfig = {}
var _bundles = [];
var _gameManifestPath = ""
var releaseGames = []
var _manifestOutPut = ""

/**
 * 主流程控制
 * @param {*} projectPath 项目路径
 * @param {*} pluginPath 插件根目录
 * @param {*} options 可选参数
 */
function start(projectPath, pluginPath, options) {
    _projectPath = projectPath;
    _root = pluginPath;
    _options = options;
    // 读取配置
    const configPath = path.join(_root, 'settings', 'pack.config.yml');
    if (!fs.existsSync(configPath)) {
        console.error(`配置文件不存在 -> `, configPath);
        return;
    }
    let configStr = fs.readFileSync(configPath).toString();
    configData = yaml.parse(configStr);
    // 获取token
    Http.login(configData.loginName, configData.loginPassword, (token) => {
        init(token);
    });
}

// 路径不存在，就生成目录
function _mkdirSync(path) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }
}

function init(token) {
    console.log("[init]初始化 -> ");
    console.log("token：", token);
    _token = token;
    if (!_options.is_release) {
        // 全部以这个目录为根目录，简化配置
        _mkdirSync(Root);
        // 兼容windows和mac环境
        let buildRoot = ""
        if (sys === 'darwin') {
            buildRoot = configData.mac.buildRoot;
            _manifestOutPut = configData.mac.manifestOutPut;
        } else if (sys === 'win32') {
            buildRoot = configData.windows.buildRoot;
            _manifestOutPut = configData.windows.manifestOutPut;
        }
        _mkdirSync(buildRoot);
        _buildPath = path.join(buildRoot, configData.appName);
        // manifest输出目录
        _mkdirSync(_manifestOutPut);
        // 构建后的源代码
        _sourceRoot = path.join(_buildPath, "jsb-default");
        // 代码更新
        _options.is_pull && pull();
    }
    // 必须走这一步
    projectSort();
}

/**
 * 代码更新
 */
function pull() {
    console.log("[pull]代码更新 -> ");
    let shell_1 = shell.exec("git name-rev --name-only HEAD");
    let branchName = shell_1.stdout.replace("\n", "");
    console.log("当前分支：", branchName);
    if (branchName != "master_dev") {
        console.error("当前分支不在master_dev上，为了保护开发分支，将不会更新代码");
    } else {
        let cmd1 = `git checkout ${_projectPath}/assets/games`;
        shell.exec(cmd1);
        let cmd2 = `git clean -df ${_projectPath}/assets/games`;
        shell.exec(cmd2);
    }
    let shell_2 = shell.exec("git pull");
    if (shell_2.code != 0) {
        console.error("代码拉取失败，程序终止！");
        process.exit(-1);
    }
}

/**
 * 项目整理
 */
function projectSort() {
    console.log("[项目整理] -> ");
    let packGames = [];
    // 子游戏处理
    let gamesConfigs = fs.readFileSync(path.join(`${_root}`, "settings", "bundles.json"));
    _gameConfigs = JSON.parse(gamesConfigs);
    _gameBundles = {};
    // 判断配置文件中是否存在需要打包的子游戏，如果存在，返回参数信息
    var includeGame = function (gameKey) {
        for (let i = 0; i < _options.games.length; i++) {
            const game = _options.games[i];
            if (game.key == gameKey) {
                return { isExist: true, data: game }
            }
        }
        return { isExist: false }
    }
    let games = _gameConfigs.games;
    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        let gameKey = game.gameKey;
        let obj = includeGame(gameKey);
        let bundleKey = "Mini" + gameKey;
        let version = "";
        let remarks = "";
        let is_pack = false;
        // 是否参与打包/发布
        is_pack = !_options.is_framework && (_options.is_pack_all || obj.isExist);
        if (is_pack) {
            if (!_options.is_release) {
                if (_options.is_pack_all && _options.pack_obj) {
                    version = _options.pack_obj.v;
                    remarks = _options.pack_obj.m;
                } else {
                    version = obj.data.v;
                    remarks = obj.data.m;
                }
                // 版本处理，通过请求后台最高版本自动升
                let child = child_process.execFileSync("python", [path.join(_root, "src/py/getGameVersion.py"), bundleKey, _token]);
                let last_version = child.toString().replace("\n", "").trim();
                // 版本合法判断
                if (!isValid(last_version)) {
                    last_version = "1.0.0.0"
                }
                // 对比参数的版本和后台版本，是否合法
                if (!compareVersion(version, last_version)) {
                    console.log(`[${gameKey}] 版本未传或者输入的版本不合法，将根据后台版本自动升版本：", ${version}, ${last_version}`);
                    version = getVersion(last_version);
                }
                // 热更注释处理
                if (!remarks || remarks.length < 5) {
                    remarks = "优化了一些已知的问题"
                }
                packGames.push(gameKey.toLowerCase());
            } else {
                releaseGames.push({ bundleKey: bundleKey, game_area_id: game.areaId });
            }
        }
        // 所有游戏均要参与分包
        if (!_options.is_release) {
            if (!version || version.length == 0) {
                version = "1.0.0.0"
            }
            _gameBundles[bundleKey] = {
                is_pack: is_pack,
                version: version,
                remarks: remarks,
                game_area_id: game.areaId,
                gameName: game.name
            }
        }
    }
    // 发布逻辑
    if (_options.is_release) {
        if (!_options.is_framework && releaseGames.length == 0) {
            console.log("没有检测到子游戏要发布，可能是GameKey拼写错误，或者没有配置该游戏");
            process.exit(0);
        }
        if (_options.is_framework) {
            console.log("本次发布框架");
        }
        if (releaseGames.length > 0) {
            console.log("本次发布的子游戏：", releaseGames);
        }
        releaseProject();
    } else {
        if (!_options.is_framework && packGames.length == 0) {
            console.log("没有检测到子游戏要更新，可能是GameKey拼写错误，或者没有配置该游戏");
            process.exit(0);
        }
        console.log(_gameBundles);
        if (!_options.is_framework) {
            console.log("本次打包的子游戏：", packGames);
        }
        _bundles = Object.keys(_gameBundles);
        // 框架处理
        if (_options.is_framework) {
            let version = _options.pack_obj.v;
            let remarks = _options.pack_obj.m;
            // 版本处理，通过请求后台最高版本自动升
            Http.getFrameVersion((data) => {
                // 对比参数的版本和后台版本，是否合法
                let last_version = data.patch_version;
                if (!isValid(last_version)) {
                    last_version = "1.0.0.0";
                }
                if (!compareVersion(version, last_version)) {
                    console.log(`框架版本未传或者输入的版本不合法，将根据后台版本自动升版本：", ${version}, ${last_version}`);
                    version = getVersion(last_version);
                }
            });
            if (!version || version.length == 0) {
                console.error("获取框架版本失败，程序终止！！！");
                process.exit(0);
            }
            // 热更注释处理
            if (!remarks || remarks.length < 5) {
                remarks = "优化了一些已知的问题"
            }
            _frameworkConfig = {
                version: version,
                remarks: remarks,
            }
            console.log("框架配置信息：", _frameworkConfig);
        }
        // 绕过构建
        if (_options.no_build) {
            packProject();
            return;
        }
        let child = child_process.execFile("python", [path.join(_root, "src/py/project_sort.py"), _projectPath, _options.is_framework, packGames]);
        child.stdout.setEncoding("utf8");
        child.stdout.on('data', (data) => {
            console.log(data.toString());
        });
        child.stderr.on('data', (data) => {
            console.error(data.toString());
        });
        child.on('close', (code) => {
            if (code == 0) {
                build(packProject);
            }
        });
    }
}

function isValid(version) {
    // 参数未传版本，不合法
    if (!version) {
        return false;
    }
    let _versions = version.split(".").map(Number);
    if (_versions.length != 4) {
        return false;
    }
    for (let i = 0; i < _versions.length; i++) {
        const _version = _versions[i];
        if (!(_version >= 0 && _version <= 99)) {
            return false;
        }
    }
    return true;
}

function compareVersion(version, last_version) {
    // 参数未传版本，不合法
    if (!isValid(version)) {
        return false;
    }
    // 参数版本不符合要求
    let _versions = version.split(".").map(Number);
    let _lastVersions = last_version.split(".").map(Number);
    if (_versions.length != 4 || _lastVersions.length != 4) {
        return false;
    }
    // 保护版本的前两位，避免错误输入导致版本升高异常
    if (_versions[0] != _lastVersions[0] || _versions[1] != _lastVersions[1]) {
        return false;
    }
    // 只允许第三位或第四位手动升版本
    if (_versions[2] > _lastVersions[2]) {
        if (_versions[2] <= 99 && _versions[3] <= 99) {
            return true;
        }
    } else {
        if (_versions[2] == _lastVersions[2]) {
            if (_versions[3] > _lastVersions[3]) {
                if (_versions[3] <= 99) {
                    return true;
                }
            }
        }
    }
    return false;
}

function _delDir(e) {
    let t = function (e) {
        let i = fs.readdirSync(e);
        for (let s in i) {
            let r = path.join(e, i[s]);
            fs.statSync(r).isDirectory() ? t(r) : fs.unlinkSync(r)
        }
    }, i = function (t) {
        let s = fs.readdirSync(t);
        if (s.length > 0) {
            for (let e in s) {
                let r = path.join(t, s[e]);
                i(r)
            }
            t !== e && fs.rmdirSync(t)
        } else t !== e && fs.rmdirSync(t)
    };
    t(e), i(e)
}

function delFile(path) {
    if (fs.existsSync(path)) {
        let isFolder = fs.statSync(path).isDirectory();
        if (!isFolder) {
            fs.unlinkSync(path);
            return
        }
        _delDir(path);
        fs.rmdirSync(path);
    }
}

function resetManifest(rootPath, bundleKey) {
    let manifestPath = path.join(rootPath, "project.manifest");
    let vermanifestPath = path.join(rootPath, "version.manifest");
    if (fs.existsSync(manifestPath)) {
        let fileStr = fs.readFileSync(manifestPath, 'utf-8');
        let manifest = JSON.parse(fileStr);
        manifest.version = "1.0.0.0";
        manifest.assets = {};
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    if (fs.existsSync(vermanifestPath)) {
        let fileStr = fs.readFileSync(vermanifestPath, 'utf-8');
        let vermanifest = JSON.parse(fileStr);
        vermanifest.version = "1.0.0.0";
        fs.writeFileSync(vermanifestPath, JSON.stringify(vermanifest));
    }
    console.log("分包[" + bundleKey + "] Manifest已被重置");
}

// 项目发布
function releaseProject() {
    console.log("[发布] 开始发布");
    let _games = [];
    for (let i = 0; i < releaseGames.length; i++) {
        const releaseGame = releaseGames[i];
        _games.push(JSON.stringify(releaseGame));
    }
    let child = child_process.execFile("python", [path.join(_root, "src/py/releaseVersion.py"), _games, _token, _options.is_framework]);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    child.on('close', (code) => {
        if (code == 0) {
            console.log(`---------发布完毕---------`);
        }
    });
}

// 项目打包
function packProject() {
    console.log("[打包] 开始打包");
    _gameManifestPath = path.join(_sourceRoot, "assets/gamemanifest");
    _mkdirSync(_gameManifestPath);
    // 开始打包
    var _pack = function (index) {
        doPackGame(index).then((flag) => {
            if (flag) {
                _pack(index + 1);
            } else {
                // 框架打包，先等子游戏的manifest文件生成完后，再生成主包manifest文件
                if (_options.is_framework) {
                    doPackFrame();
                }
            }
        }).catch((error) => {
            console.log(error);
        })
    }
    _pack(0);
}

function doPackGame(index) {
    return new Promise(function (resolve, reject) {
        if (index >= _bundles.length) {
            resolve(false);
            return;
        }
        let bundleKey = _bundles[index];
        // 打子游戏包，不加入pack的游戏不分包
        if (!_options.is_framework && !_gameBundles[bundleKey].is_pack) {
            resolve(true);
            return;
        }
        console.log("\n------", bundleKey);
        let packageUrl = _gameConfigs.packageUrl;
        var packVersion = path.join(_projectPath, "packVersion");
        _mkdirSync(packVersion);
        let version = _gameBundles[bundleKey].version;
        let subgameRootPath = path.join(_sourceRoot, "assets", bundleKey);
        _mkdirSync(subgameRootPath);
        let submanifest = {
            version: version,
            packageUrl: packageUrl + bundleKey + "/" + version,
            remoteManifestUrl: packageUrl + bundleKey + "/" + version + "/project.manifest",
            remoteVersionUrl: packageUrl + bundleKey + "/" + version + "/version.manifest",
            assets: {},
            searchPaths: []
        };
        _readDir(subgameRootPath, submanifest.assets, subgameRootPath);
        let manifestGamePath = path.join(_manifestOutPut, bundleKey);
        _mkdirSync(manifestGamePath);
        // project.manifest
        fs.writeFileSync(path.join(manifestGamePath, `project.manifest`), JSON.stringify(submanifest));
        fs.writeFileSync(path.join(subgameRootPath, `project.manifest`), JSON.stringify(submanifest));
        console.log(`[Build] 生成 ${bundleKey}/project.manifest成功`);
        // version.manifest
        delete submanifest.assets;
        delete submanifest.searchPaths;
        fs.writeFileSync(path.join(manifestGamePath, `version.manifest`), JSON.stringify(submanifest));
        fs.writeFileSync(path.join(subgameRootPath, `version.manifest`), JSON.stringify(submanifest));
        console.log(`[Build] 生成 ${bundleKey}/version.manifest成功`);
        if (!_options.is_framework) {
            let packZipName = version + ".zip",
                packZipRootPath = path.join(packVersion, bundleKey);
            _mkdirSync(packZipRootPath);
            let packVersionZipPath = path.join(packZipRootPath, packZipName);
            fs.existsSync(packZipRootPath) || fs.mkdirSync(packZipRootPath);
            fs.existsSync(packVersionZipPath) && (fs.unlinkSync(packVersionZipPath), console.log("[Pack] 发现该版本的zip, 已经删除!"));
            console.log("[Pack] 开始打包子游戏版本 ...");
            const jszip = new JsZip();
            _packageDir(subgameRootPath, jszip);
            jszip.generateNodeStream({
                type: "nodebuffer",
                streamFiles: !0
            }).pipe(fs.createWriteStream(packVersionZipPath)).on("finish", () => {
                console.log(`[Pack] ${bundleKey}打包成功: ` + packVersionZipPath);
                if (!_options.no_upload) {
                    uploadGameZip(bundleKey, packVersionZipPath, resolve);
                } else {
                    resolve(true);
                }
            }).on("error", (e) => {
                console.log(`[Pack] ${bundleKey}打包失败:` + e.message);
                reject();
            })
        } else {
            // 将子游戏Manifest文件加入框架Manifest
            _mkdirSync(path.join(_gameManifestPath, bundleKey))
            cpdir(subgameRootPath, path.join(_gameManifestPath, bundleKey));
            resolve(true);
        }
    });
}

// 执行框架打包
function doPackFrame() {
    console.log("[Build] 开始生成框架manifest配置文件....");
    let frame_version = _frameworkConfig.version;
    let serverRootDir = _gameConfigs.hotUpdateUrl + frame_version;
    let manifest = {
        version: frame_version,
        packageUrl: serverRootDir,
        remoteManifestUrl: serverRootDir + "/project.manifest",
        remoteVersionUrl: serverRootDir + "/version.manifest",
        assets: {},
        searchPaths: [],
    };
    _readDir(path.join(_sourceRoot, "src"), manifest.assets, _sourceRoot);
    _readDir(path.join(_sourceRoot, "jsb-adapter"), manifest.assets, _sourceRoot);
    var assets = fs.readdirSync(path.join(_sourceRoot, "assets"));
    assets.forEach((dir) => {
        let dirRoot = fs.statSync(path.join(_sourceRoot, "assets", dir));
        // 框架主包资源
        if (dirRoot.isDirectory() && dir.indexOf("Mini") == -1 && dir.indexOf("gamemanifest") == -1) {
            _readDir(path.join(_sourceRoot, "assets", dir), manifest.assets, _sourceRoot);
        }
    })
    // 框架Manifest需要最后保存，保证子游戏添加可以热更实现
    _readDir(_gameManifestPath, manifest.assets, _sourceRoot);
    // project.manifest
    fs.writeFileSync(path.join(_sourceRoot, "project.manifest"), JSON.stringify(manifest));
    console.log(`[Build] 生成框架project.manifest成功`);
    // version.manifest
    delete manifest.assets;
    delete manifest.searchPaths;
    fs.writeFileSync(path.join(_sourceRoot, `version.manifest`), JSON.stringify(manifest));
    console.log(`[Build] 生成框架version.manifest成功`);
    // 主包内删除分包Bundle，对主包重新打包
    for (let i = 0; i < _bundles.length; i++) {
        let key = _bundles[i];
        let subgameRootPath = path.join(_sourceRoot, `assets/${key}`);
        let subgameManifestPath = path.join(_sourceRoot, `assets/gamemanifest/${key}`)
        delFile(path.join(subgameRootPath, 'config.json'));
        delFile(path.join(subgameRootPath, 'index.js'));
        delFile(path.join(subgameRootPath, 'import'));
        delFile(path.join(subgameRootPath, 'native'));
        console.log("分包[" + key + "]已被剔除");
        resetManifest(subgameRootPath, key);
        resetManifest(subgameManifestPath, key);
    }
    // 打zip包，并上传
    console.log("[Pack] 开始打包平台版本 ...");
    const jszip = new JsZip();
    // 打包src目录的代码资源
    _packageDir(path.join(_sourceRoot, "src"), jszip.folder("src"));
    // 打包assets目录的代码资源
    _packageDir(path.join(_sourceRoot, "assets"), jszip.folder("assets"));
    // 打包jsb-adapter目录的代码资源
    _packageDir(path.join(_sourceRoot, "jsb-adapter"), jszip.folder("jsb-adapter"));
    // 打包文件
    let versionManifest = path.join(_sourceRoot, "version.manifest");
    jszip.file("version.manifest", fs.readFileSync(versionManifest));
    let projectManifest = path.join(_sourceRoot, "project.manifest");
    jszip.file("project.manifest", fs.readFileSync(projectManifest));
    let packZipName = frame_version + ".zip",
        packZipRootPath = path.join(_projectPath, "packVersion");
    _mkdirSync(packZipRootPath);
    let packVersionZipPath = path.join(packZipRootPath, packZipName);
    // 开始生成zip包
    fs.existsSync(packVersionZipPath) && (fs.unlinkSync(packVersionZipPath), console.log("[Pack] 发现该版本的zip, 已经删除!"));
    jszip.generateNodeStream({
        type: "nodebuffer",
        streamFiles: !0
    }).pipe(fs.createWriteStream(packVersionZipPath)).on("finish", function () {
        console.log(`[Pack] 框架打包成功: ` + packVersionZipPath);
        if (!_options.no_upload) {
            uploadFrameZip(packVersionZipPath);
        }
    }.bind(this)).on("error", function (e) {
        console.log(`[Pack] 框架打包失败:` + e.message)
    }.bind(this))
}

function getVersion(last_version_str) {
    let last_version = last_version_str.replace("\n", "").trim().split(".");
    for (let i = last_version.length - 1; i >= 0; i--) {
        const element = parseInt(last_version[i]);
        if (element >= 99) {
            continue;
        }
        last_version[i] = (element + 1).toString();
        break;
    }
    return last_version.join(".");
}

/**
 * 项目构建
 * @param {*} callback 构建完成后回调
 */
function build(callback) {
    console.log("[build]项目构建 -> ");
    let enginePath, platform, defaultConfig;
    // 兼容windows和mac环境
    if (sys === 'darwin') {
        enginePath = `${configData.mac.cocosRoot}/${configData.engineVersion}/CocosCreator.app/Contents/MacOS/CocosCreator`;
        platform = "ios";
        defaultConfig = "inlineSpriteFrames=false;optimizeHotUpdate=true;template=default;";
    } else if (sys === 'win32') {
        enginePath = `${configData.windows.cocosRoot}/${configData.engineVersion}/CocosCreator.exe`;
        platform = "win32";
        defaultConfig = "inlineSpriteFrames=false;optimizeHotUpdate=true;template=default;";
    }
    let defaultConfigCommon = "debug=false;sourceMaps=false;md5Cache=false;";
    let child = child_process.spawn(`${enginePath}`, ["--path", `${_projectPath}`, "--build", `"platform=${platform};buildPath=${_buildPath};${defaultConfigCommon}${defaultConfig}"`]);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    child.on('close', (code) => {
        if (code == 0) {
            console.log("---------构建成功------------\n");
            // 构建完毕，执行分包流程
            if (!_options.only_build) {
                callback && callback();
            }
            // 异步还原子游戏代码
            console.log("异步还原assets/games代码");
            child_process.spawn("git", ["checkout", `${_projectPath}/assets/games`]);
        }
    });
}

function cpdir(dirOld, dirNew) {
    return new Promise(function (resolve, reject) {
        var walkDir = function (dirOld, dirNew) {
            _mkdirSync(dirNew);
            var list = fs.readdirSync(dirOld);
            list.forEach(function (item) {
                if (fs.statSync(path.join(dirOld, item)).isDirectory()) {
                    _mkdirSync(path.join(dirNew, item));
                    walkDir(path.join(dirOld, item), path.join(dirNew, item));
                } else {
                    fs.copyFile(path.join(dirOld, item), path.join(dirNew, item), function (err) {
                        if (err != null) {
                            console.log(err);
                        }
                    });
                }
            });
        }
        walkDir(dirOld, dirNew);
    });
}

function _packageDir(e, t) {
    let i = fs.readdirSync(e);
    for (let s = 0; s < i.length; s++) {
        let r = i[s],
            o = path.join(e, r),
            n = fs.statSync(o);
        n.isFile() ? t.file(r, fs.readFileSync(o)) : n.isDirectory() && _packageDir(o, t.folder(r))
    }
}

function _readDir(dir, obj, source) {
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
        return;
    }
    var subpaths = fs.readdirSync(dir),
        subpath, size, md5, compressed, relative;
    for (var i = 0; i < subpaths.length; ++i) {
        if (subpaths[i][0] === '.') {
            continue;
        }
        subpath = path.join(dir, subpaths[i]);
        stat = fs.statSync(subpath);
        if (stat.isDirectory()) {
            _readDir(subpath, obj, source);
        } else if (stat.isFile()) {
            size = stat['size'];
            md5 = require("crypto").createHash('md5').update(fs.readFileSync(subpath)).digest('hex');
            compressed = path.extname(subpath).toLowerCase() === '.zip';
            relative = path.relative(source, subpath);
            relative = relative.replace(/\\/g, '/');
            relative = encodeURI(relative);
            obj[relative] = {
                'size': size,
                'md5': md5
            };
            if (compressed) {
                obj[relative].compressed = true;
            }
        }
    }
}

function uploadGameZip(bundleKey, zipPath, resolve) {
    console.log(`[${bundleKey}]上传分包 -> ${_gameBundles[bundleKey].remarks}, ${zipPath}`);
    let child = child_process.execFile("python", [path.join(_root, "src/py/uploadGameZip.py"), bundleKey, _token, _gameBundles[bundleKey].game_area_id, _gameBundles[bundleKey].gameName, _gameBundles[bundleKey].remarks, zipPath, zipPath]);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    child.on('close', (code) => {
        if (code == 0) {
            console.log(`------${bundleKey}热更完毕---------`);
            resolve(true);
        }
    });
}

function uploadFrameZip(zipPath) {
    console.log(`[上传主包] -> ${_frameworkConfig.version}, ${_frameworkConfig.remarks}, ${zipPath}`);
    console.log("正在上传中，这个过程大概需要30秒，请耐心等待...");
    let child = child_process.execFile("python", [path.join(_root, "src/py/uploadFrameZip.py"), _token, _frameworkConfig.remarks, zipPath, zipPath]);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    child.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    child.on('close', (code) => {
        if (code == 0) {
            console.log(`------框架热更完毕---------`);
        }
    });
}

module.exports = {
    start
}