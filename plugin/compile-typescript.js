var fs = Npm.require('fs');
var path = Npm.require('path');
var mkdirp = Npm.require('mkdirp');

var packageRefs = {};
var packageDirs = {};
var appRefs = [];
var appDirs = [];

// compiled js and sourcemaps will be cached here
if (!fs.existsSync('.meteor/cache')) {
	mkdirp.sync('.meteor/cache');
}

function getPackageRefs(dir, packageName) {
	var res = "";
	for (var entry in packages[packageName]) {
		res += '///<reference path="' + path.relative(dir, entry) + '" />\n';
	};
	return res;
}

function getAppRefs(side) {
	var res = '';
	var packages = fs.readFileSync('.meteor/packages').toString().split('\n');
	packages.forEach(function (entry) {
		if (!entry || entry.charAt(0) === '#' || !typescriptPackages[entry]) {
			return;
		}
		res += '///<reference path="' + path.relative('.meteor', path.join('../meteor/packages', entry, '.package-' + side + '.d.ts')) + '" />\n';
	});
	appRefs.forEach(function (entry) {
		if (
			side === 'client' && entry.substr(0, 'server'.length + 1) !== 'server/' ||
			side === 'server' && entry.substr(0, 'client'.length + 1) !== 'client/'
		) {
			res += '///<reference path="' + path.relative('.meteor', entry) + '" />\n';
		}
	});
	return res;
}

function getPackages() {
	var packages = {};
	var Package = {
		describe: function(){},
		_transitional_registerBuildPlugin: function(){},
		register_extension: function(){},
		on_use: function(callback){
			callback(api);
		},
		on_test: function(){}
	};
	Npm.depends = function(){};
	var api = {
		add_files: function(){},
		imply: function(){},
		use: function(){},
		export: function(){}
	}
	fs.readdirSync('../meteor/packages').forEach(function(package){
		if (package.charAt(0) === '.') {
			return;
		}
		initPackage(package);
		var packageJsPath = '../meteor/packages/' + package + '/package.js';
		if (package.charAt(0) === '.' || !fs.existsSync(packageJsPath)) {
			return;
		}
		var packageJs = fs.readFileSync(packageJsPath).toString();
		if (packageJs) {
			api.use = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || (where instanceof Array && where.indexOf('client') !== -1);
				if (!(name instanceof Array)) {
					name = [name];
				}
				name.forEach(function(item){
					initPackage(item);
					if (inServer) {
						packages[package].server.uses[item] = packages[item];
					}
					if (inClient) {
						packages[package].client.uses[item] = packages[item];
					}
				});
			};
			api.imply = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || (where instanceof Array && where.indexOf('client') !== -1);
				if (!(name instanceof Array)) {
					name = [name];
				}
				name.forEach(function(item){
					initPackage(item);
					if (inServer) {
						packages[package].server.imply[item] = packages[item];
					}
					if (inClient) {
						packages[package].client.imply[item] = packages[item];
					}
				});
			};
			api.add_files = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || (where instanceof Array && where.indexOf('client') !== -1);
				if (!(name instanceof Array)) {
					name = [name];
				}
				var items = name.filter(function(item){
					return item.substr(item.length - 3) === '.ts';
				});
				if (inServer) {
					packages[package].server.files = packages[package].server.files.concat(items);
				}
				if (inClient) {
					packages[package].client.files = packages[package].client.files.concat(items);
				}
			};
			Package.on_use = function(callback){
				callback(api);
			}
			eval(packageJs);
		}
	});
	return packages;
	function initPackage(name) {
		if (typeof(packages[name]) === 'undefined') {
			packages[name] = {
				server: {
					uses: {},
					imply: {},
					files: []
				},
				client: {
					uses: {},
					imply: {},
					files: []
				}
			}
		}
	}
}

function getTypescriptPackages() {
	var packages = getPackages();
	for (var i in packages) {
		var package = packages[i];
		if (!package.server.uses.typescript && !package.client.uses.typescript && i !== 'typescript') {
			delete packages[i];
		}
		else {
			for (var j in package.server.uses) {
				if (!package.server.uses[j].server.uses.typescript && j !== 'typescript') {
					delete package.server.uses[j];
				}
			}
			for (var j in package.client.uses) {
				if (!package.client.uses[j].client.uses.typescript && j !== 'typescript') {
					delete package.client.uses[j];
				}
			}
		}
	}
	delete packages.typescript;
	for (var i in packages) {
		var package = packages[i];
		delete package.server.uses.typescript;
		delete package.client.uses.typescript;
	}

	return packages;
}

var typescriptPackages;
var lastGenerateTime;
function generatePackageRefs() {

	// generate max once per second
	var currentTime = new Date().getTime() / 1000;
	if (lastGenerateTime && currentTime - lastGenerateTime < 1) {
		return;
	}
	lastGenerateTime = currentTime;

	var packages = typescriptPackages = getTypescriptPackages();
	var packagesPath = '../meteor/packages';
	for (var i in packages) {
		for (var side in packages[i]) {
			var package = packages[i][side];
			var packagePath = path.join(packagesPath, i);

			// files
			var refs = "";
			for (var j in package.files) {
				var file = package.files[j];
				refs += '///<reference path="' + file + '" />\n';
			}
			fs.writeFileSync(path.join(packagePath, '.package-' + side + '.d.ts'), refs);

			// uses
			refs = "";
			for (j in package.uses) {
				var dep = package.files[j];
				refs += '///<reference path="' +path.join('../', j, '.package-' + side + '.d.ts') + '" />\n';
			}
			fs.writeFileSync(path.join(packagePath, '.deps-' + side + '.d.ts'), refs);
		}
	}
}

var handler = function (compileStep) {
	//console.log('COMPILING: ' + compileStep._fullInputPath);

	generatePackageRefs();

	var fullPath = compileStep._fullInputPath;
	var inputPath = '/' + compileStep.inputPath;

	//	console.log("Src: " + fullPath);
	var isRef = fullPath.substring(fullPath.length - 5) === '.d.ts';

	// cache check
	//console.log(inputPath);
	var cachePath = '.meteor/cache/' + (compileStep.packageName ? compileStep.packageName + '/' : '') + compileStep.inputPath;
	var cacheDir = path.dirname(cachePath);
	var baseName = path.basename(fullPath, '.ts');
	var changeTime = fs.statSync(fullPath).mtime;
	var jsPath;
	if (inputPath.substring(0, 10) === '/packages/') {
		jsPath = cacheDir + '/' + path.dirname(inputPath.substring(10)) + '/' + baseName + '.js';
	} else {
		var rootPath = path.normalize(fullPath.substring(0, fullPath.length - inputPath.length) + '/..');
		jsPath = cacheDir + '/' + path.dirname(path.relative(rootPath, fullPath)) + '/' + baseName + '.js';
	}
	var mapPath = jsPath + '.map';
	var error;

	// references
	var dir = path.dirname(fullPath);
	if (compileStep.packageName) {
		var packagePath = path.join('../meteor/packages', compileStep.packageName);
		fs.writeFileSync(path.join(dir, '.server.d.ts'),
			'///<reference path="' + path.relative(dir, path.join(packagePath, '.deps-server.d.ts')) + '" />\n' +
			'///<reference path="' + path.relative(dir, path.join(packagePath, '.package-server.d.ts')) + '" />\n'
		);
		fs.writeFileSync(path.join(dir, '.client.d.ts'),
			'///<reference path="' + path.relative(dir, path.join(packagePath, '.deps-client.d.ts')) + '" />\n' +
			'///<reference path="' + path.relative(dir, path.join(packagePath, '.package-client.d.ts')) + '" />\n'
		);
	}
	else {
		if (appDirs.indexOf(dir) == -1) {
			appDirs.push(dir);
		}
		if (appRefs.indexOf(compileStep.inputPath) == -1) {
			appRefs.push(compileStep.inputPath);
			appDirs.forEach(function (dir) {
				fs.writeFileSync(dir + "/.server.d.ts", '///<reference path="' + path.relative(dir, '.meteor/.app-server.d.ts') + '" />\n');
				fs.writeFileSync(dir + "/.client.d.ts", '///<reference path="' + path.relative(dir, '.meteor/.app-client.d.ts') + '" />\n');
			});
			fs.writeFileSync('.meteor/.app-server.d.ts', getAppRefs('server'));
			fs.writeFileSync('.meteor/.app-client.d.ts', getAppRefs('client'));
		}
	}

	// dont compile d.ts files
	if (isRef) {
		return;
	}

	if (!fs.existsSync(cacheDir)) {
		mkdirp.sync(cacheDir);
	}

//	console.log('TS cache exists: ' + cachePath + ' ' + fs.existsSync(cachePath));
	if (!fs.existsSync(cachePath) || changeTime.getTime() > fs.statSync(cachePath).mtime.getTime()) {

		var execSync = Npm.require('exec-sync');

		var ERROR = "\nTypeScript compilation failed!\n";
		ERROR = ERROR + (new Array(ERROR.length - 1).join("-")) + "\n";

		var compileCommand = 'tsc --target ES5 --sourcemap --outDir ' + cacheDir + ' ' + fullPath;

		//		var compileCommand = 'tsc --nolib --sourcemap --out ' + cacheDir + " " + fullPath; // add client,server module type switch?
		var result = null;

		// Compile the TypeScript file with the TypeScript command line compiler.
		// Until the TypeScript module provides a public API there is no reliable way around it without changing the
		// TypeScript sources.

		try {
			result = execSync(compileCommand);
//			console.log(compileCommand);
//			console.log(result);
		} catch (e) {

			var lines = e.message.split('\n');
			var errors = [];
			for (var i = 0; i < lines.length; i++) {
				//if (
					//					lines[i].trim() &&
					// !/The property '__super__' does not exist on value of type/.test(lines[i]) &&
					//					lines[i].substr(-36) !== 'Base type must be interface or class' &&
					//					lines[i].substr(-30) !== 'not exist in the current scope' &&
					//									lines[i].substr(-24) !== 'lacks an implementation.'
					//				lines[i].indexOf('error TS2095') == -1
				//) {
					errors.push(lines[i]);
				//}
			}
			if (errors.length > 0) {
				error = ERROR + errors.join('\n');
			}
			else
				result = true;
		}
//		console.log(cacheDir + ' ' + error + ' ' + result);
		if (fs.existsSync(cacheDir + '/' + baseName + '.js')) {
			jsPath = cacheDir + '/' + baseName + '.js';
			mapPath = jsPath + '.map';
		}
		if (fs.existsSync(jsPath)) {
//			console.log(jsPath)

			var sourceBuffer = new Buffer(fs.readFileSync(fullPath));
			var compiledBuffer = new Buffer(
				fs.readFileSync(jsPath).toString().replace(
					/\/\/@ sourceMappingURL=[0-9a-zA-Z_.-]+/,
					'//@ sourceMappingURL=' + inputPath + '.map?' + changeTime.getTime()
				)
			);
//			var mapBuffer = new Buffer(
//				fs.readFileSync(mapPath).toString().replace(
//					/"sources":\["[0-9a-zA-Z-\/\.-]+"]/,
//					'"sources":["' + path.dirname(inputPath) + '/' + path.basename(inputPath) + '?' + changeTime.getTime() + '"]'
//				)
//			);
//			console.log('1: ' + jsPath);
			if (error) {
				try {
					fs.unlinkSync(cachePath);
					fs.unlinkSync(cachePath + '.js');
//					fs.unlinkSync(cachePath + '.map');
					fs.unlinkSync(jsPath);
//					fs.unlinkSync(mapPath);
				}
				catch (e) {
					// ignore
				}
				throw new Error(error);
			}
			fs.writeFileSync(cachePath, sourceBuffer);
			fs.writeFileSync(cachePath + '.js', compiledBuffer);
//			fs.writeFileSync(cachePath + '.map', mapBuffer);

			fs.unlinkSync(jsPath);
//			fs.unlinkSync(mapPath);

		}
		else {
			try {
				fs.unlinkSync(cachePath);
				fs.unlinkSync(cachePath + '.js');
//				fs.unlinkSync(cachePath + '.map');
			}
			catch (e) {
				// ignore
			}
			if (error) {
				throw new Error(error);
			}
			else {
				throw new Error(ERROR + 'file was not created: \n' + compileStep.inputPath + '\n' + jsPath + '\n' + inputPath + '\n' + cacheDir + '\n' + fullPath);
			}
		}

	}
	var data = fs.readFileSync(cachePath + '.js').toString();

	// couple of hacks for meteor namespaceing
	var prep = '';
	data = data
		.replace(/(new __\(\);\n\};\n)var ([a-zA-Z0-9_]+);/, '$1' + prep)
		.replace(/(<reference path="[a-zA-Z0-9_\.\/-]+"[ ]*\/>\n)var ([a-zA-Z0-9_]+);/, '$1' + prep)
		.replace(/^\s*var ([a-zA-Z0-9_]+);/, prep)
		.replace(/\}\)\(([a-zA-Z0-9_]+) \|\| \(([a-zA-Z0-9_]+) = \{\}\)\);(\n\/\/# sourceMappingURL)/, '})($1);$3');
//	data = data
//		.replace(/(new __\(\);\n\};\n)var ([a-zA-Z0-9_]+);/, '$1this.$2 = this.$2 || {};\nvar $2 = this.$2;')
//		.replace(/(<reference path="[a-zA-Z0-9_\.\/-]+"[ ]*\/>\n)var ([a-zA-Z0-9_]+);/, '$1this.$2 = this.$2 || {};\nvar $2 = this.$2;')
//		.replace(/^\s*var ([a-zA-Z0-9_]+);/, 'this.$1 = this.$1 || {};\nvar $1 = this.$1;');

	compileStep.addJavaScript({
	  path: compileStep.inputPath + ".js",
	  sourcePath: compileStep.inputPath,
	  data: data
//	  sourceMap: fs.readFileSync(cachePath + '.map').toString()
	});

};

Plugin.registerSourceHandler("ts", handler);