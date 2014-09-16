var fs = Npm.require('fs');
var path = Npm.require('path');
var mkdirp = Npm.require('mkdirp');

var appRefs = [];
var appDirs = [];
var meteorPath = fs.existsSync('../meteor') ? '../meteor' : '../../meteor';
var appPath = fs.existsSync('.meteor') ? '.meteor' : '../.meteor';
var packagesPath = path.join(meteorPath, 'packages');
var cacheDir = path.join(meteorPath, '.cache');
var allServerPath = path.join('.meteor', '.all-server.d.ts');
var allClientPath = path.join('.meteor', '.all-client.d.ts');
var allPath = path.join('.meteor', '.all.ts');
var dummyPath = path.join('.meteor', '.dummy.ts');

var typescriptPackages = getTypescriptPackages();

initDirs();
initAppRefs();

function initDirs() {

	// compiled js and sourcemaps will be cached here
	if (!fs.existsSync(cacheDir)) {
		mkdirp.sync(cacheDir);
	}

	if (!fs.existsSync(dummyPath)) {
		fs.writeFileSync(dummyPath, '');
	}

	if (!fs.existsSync(allServerPath)) {
		fs.writeFileSync(allServerPath,
			'///<reference path=".packages-server.d.ts" />\n' +
			'///<reference path=".app-server.d.ts" />\n'
		);
	}

	if (!fs.existsSync(allClientPath)) {
		fs.writeFileSync(allClientPath,
			'///<reference path=".packages-client.d.ts" />\n' +
			'///<reference path=".app-client.d.ts" />\n'
		);
	}

	if (!fs.existsSync(allPath)) {
		fs.writeFileSync(allPath,
			'///<reference path=".dummy.ts" />\n' +
			'///<reference path=".all-server.d.ts" />\n' +
			'///<reference path=".all-client.d.ts" />\n'
		);
	}

}

function initAppRefs(curPath) {
	if (!curPath) {
		curPath = '.';
	}
	var addDir;
	fs.readdirSync(curPath).forEach(function(item){
		if (item.charAt(0) === '.') {
			return;
		}
		var fullPath = path.join(curPath, item);
		if (fs.lstatSync(fullPath).isDirectory()) {
			initAppRefs(fullPath);
		}
		else if (item.slice(-3) === '.ts') {
			addDir = true;
			appRefs.push(fullPath);
		}
	});

	if (addDir) {
		appDirs.push(curPath);
	}

	if (curPath === '.') {
		appDirs.forEach(function (dir) {
			fs.writeFileSync(dir + "/.server.d.ts", '///<reference path="' + path.relative(dir, '.meteor/.app-server.d.ts') + '" />\n');
			fs.writeFileSync(dir + "/.client.d.ts", '///<reference path="' + path.relative(dir, '.meteor/.app-client.d.ts') + '" />\n');
		});
		fs.writeFileSync('.meteor/.app-server.d.ts', getAppRefs('server'));
		fs.writeFileSync('.meteor/.app-client.d.ts', getAppRefs('client'));
	}

}

function getAppRefs(side) {
	var res = '';
	var packages = fs.readFileSync('.meteor/packages').toString().split('\n');
	packages.forEach(function (entry) {
		if (!entry || entry.charAt(0) === '#' || entry == 'path' || !typescriptPackages[entry]) {
			return;
		}
		var packagePath = path.join(packagesPath, entry);
		if (fs.existsSync(path.join('packages', entry))) {
			packagePath = path.join(path.join('packages', entry));
		}
		res += '///<reference path="' + path.relative('.meteor', path.join(packagePath, '.implies-' + side + '.d.ts')) + '" />\n';
		res += '///<reference path="' + path.relative('.meteor', path.join(packagePath, '.files-' + side + '.d.ts')) + '" />\n';
	});
	appRefs.forEach(function (entry) {
		if (
			side === 'client' && entry.substr(0, 'server'.length + 1) !== 'server/' ||
			side === 'server' && entry.substr(0, 'client'.length + 1) !== 'client/'
		) {
			res += '///<reference path="' + path.relative('.meteor', entry) + '" />\n';
		}
	});
//	res += '///<reference path="' + path.relative('.meteor', '.dummy.ts') + '" />\n';
	return res;
}

// gets all packages with their files, uses and implies
function getPackages() {
	var packages = {};
	var Package = {
		describe: function(){},
		_transitional_registerBuildPlugin: function(){},
		register_extension: function(){},
		on_use: function(callback){
			callback(api);
		},
		onUse: function(callback){
			callback(api);
		},
		on_test: function(){},
		onTest: function(){},
	};
	Npm.depends = function(){};
	var Cordova = {depends: function(){}};
	var api = {
		add_files: function(){},
		addFiles: function(){},
		imply: function(){},
		use: function(){},
		export: function(){}
	}

	fs.readdirSync(packagesPath).forEach(handlePackage);
	if (fs.existsSync('packages')) {
		fs.readdirSync('packages').forEach(handlePackage);
	}
	return packages;

	function initPackage(name) {
		if (typeof(packages[name]) === 'undefined') {
			var packagePath = path.join(packagesPath, name);
			if (fs.existsSync(path.join('packages', name))) {
				packagePath = path.join('packages', name);
			}
			packages[name] = {
				path: packagePath,
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

	function handlePackage(package) {
		if (package.charAt(0) === '.') {
			return;
		}
		initPackage(package);
		var packageJsPath = path.join(packagesPath, package, 'package.js');
		if (fs.existsSync(path.join('packages', package))) {
			packageJsPath = path.join('packages', package, 'package.js');
		}
		if (package.charAt(0) === '.' || !fs.existsSync(packageJsPath)) {
			return;
		}
		var packageJs = fs.readFileSync(packageJsPath).toString();
		if (packageJs) {
			api.use = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || where === 'web.cordova' || (where instanceof Array && (where.indexOf('client') !== -1 || where.indexOf('web.cordova') !== -1));
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
				var inClient = !where || where === 'client' || where === 'web.cordova' || (where instanceof Array && (where.indexOf('client') !== -1 || where.indexOf('web.cordova') !== -1));
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
			api.add_files = api.addFiles = function (name, where) {
				var inServer = !where || where === 'server' || (where instanceof Array && where.indexOf('server') !== -1);
				var inClient = !where || where === 'client' || where === 'web.cordova' || (where instanceof Array && (where.indexOf('client') !== -1 || where.indexOf('web.cordova') !== -1));
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
			Package.on_use = Package.onUse = function(callback){
				callback(api);
			}
			Package.includeTool = function(){};
			try {
				eval(packageJs);
			}
			catch (err) {
				console.log(packageJs);
				throw err;
			}
		}
	}

}

// filters out only typescript packages
function getTypescriptPackages() {
	var packages = getPackages();
	for (var i in packages) {
		var package = packages[i];
		if (!usesTypescript(package) && i !== 'typescript') {
			delete packages[i];
		}
		else {
			for (var j in package.server.uses) {
				var item = package.server.uses[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.server.uses[j];
				}
			}
			for (var j in package.client.uses) {
				var item = package.client.uses[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.client.uses[j];
				}
			}
			for (var j in package.server.imply) {
				var item = package.server.imply[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.server.imply[j];
				}
			}
			for (var j in package.client.imply) {
				var item = package.client.imply[j];
				if (!usesTypescript(item) && j !== 'typescript') {
					delete package.client.imply[j];
				}
			}
		}
	}
	delete packages.typescript;
	for (var i in packages) {
		var package = packages[i];
		delete package.server.uses.typescript;
		delete package.client.uses.typescript;
		delete package.server.imply.typescript;
		delete package.client.imply.typescript;
	}

	return packages;

	function usesTypescript(package) {
		if (package.server.uses.typescript || package.client.uses.typescript) {
			return true;
		}
		for (var i in package.server.uses) {
			if (checkImpliesServer(package.server.uses[i])) {
				return true;
			}
		}
		for (var i in package.client.uses) {
			if (checkImpliesClient(package.client.uses[i])) {
				return true;
			}
		}
		return false;

		function checkImpliesServer(package){
			if (package.server.imply.typescript) {
				return true;
			}
			for (var i in package.server.imply) {
				if (checkImpliesServer(package.server.imply[i])) {
					return true;
				}
			}
			return false;
		}
		function checkImpliesClient(package){
			if (package.client.imply.typescript) {
				return true;
			}
			for (var i in package.client.imply) {
				if (checkImpliesServer(package.client.imply[i])) {
					return true;
				}
			}
			return false;
		}
	}
}

// generates .d.ts reference files for packages
var lastGenerateTime;
function generatePackageRefs() {

	// generate max once per second
	var currentTime = new Date().getTime() / 1000;
	if (lastGenerateTime && currentTime - lastGenerateTime < 1) {
		return;
	}
	lastGenerateTime = currentTime;

	var packages = typescriptPackages;
	var allServerRefs = '';
	var allClientRefs = '';
	for (var i in packages) {
		var packagePath = packages[i].path;
		for (var side in packages[i]) {
			if (side == 'path') {
				continue;
			}
			var package = packages[i][side];
			var filesPath = path.join(packagePath, '.files-' + side + '.d.ts');
			var usesPath = path.join(packagePath, '.uses-' + side + '.d.ts');
			var impliesPath = path.join(packagePath, '.implies-' + side + '.d.ts');

			// own files
			var refs = '';
			var dir;
			for (var j in package.files) {
				refs += '///<reference path="' + package.files[j] + '" />\n';

				// shortcuts
				dir = path.dirname(path.join(packagePath, package.files[j]));
				fs.writeFileSync(path.join(dir, '.server.d.ts'),
//					'///<reference path="' + path.relative(dir, '.dummy.ts') + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, '.uses-server.d.ts')) + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, '.files-server.d.ts')) + '" />\n'
				);
				fs.writeFileSync(path.join(dir, '.client.d.ts'),
//					'///<reference path="' + path.relative(dir, '.dummy.ts') + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, '.uses-client.d.ts')) + '" />\n' +
					'///<reference path="' + path.relative(dir, path.join(packagePath, '.files-client.d.ts')) + '" />\n'
				);

			}
			fs.writeFileSync(filesPath, refs);

			// uses
			refs = '';
			for (j in package.uses) {
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.uses[j].path, '.implies-' + side + '.d.ts')) + '" />\n';
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.uses[j].path, '.files-' + side + '.d.ts')) + '" />\n';
			}
			fs.writeFileSync(usesPath, refs);

			// implies
			refs = '';
			for (j in package.imply) {
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.imply[j].path, '.implies-' + side + '.d.ts')) + '" />\n'
				refs += '///<reference path="' + path.relative(packagePath, path.join(package.imply[j].path, '.files-' + side + '.d.ts')) + '" />\n'
			}
			fs.writeFileSync(impliesPath, refs);

			if (side == 'server') {
				allServerRefs += '///<reference path="' + path.relative('.meteor', filesPath) + '" />\n';
			}
			else if (side == 'client') {
				allClientRefs += '///<reference path="' + path.relative('.meteor', filesPath) + '" />\n';
			}

		}
	}

	fs.writeFileSync(path.join('.meteor', '.packages-server.d.ts'), allServerRefs);
	fs.writeFileSync(path.join('.meteor', '.packages-client.d.ts'), allClientRefs);

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
	var cachePath = path.join(cacheDir, path.relative('../', fullPath));
	var baseName = path.basename(fullPath, '.ts');
	var changeTime = fs.statSync(fullPath).mtime;
	var jsPath = path.join(path.dirname(cachePath), baseName + '.js');
//	var mapPath = jsPath + '.map';
	var error;

	// references
	var dir = path.dirname(path.relative('./', fullPath));
	if (compileStep.packageName) {
//		var packagePath = path.join(packagesPath, compileStep.packageName);
//		fs.writeFileSync(path.join(dir, '.server.d.ts'),
//			'///<reference path="' + path.relative(dir, path.join(packagePath, '.uses-server.d.ts')) + '" />\n' +
//			'///<reference path="' + path.relative(dir, path.join(packagePath, '.files-server.d.ts')) + '" />\n'
//		);
//		fs.writeFileSync(path.join(dir, '.client.d.ts'),
//			'///<reference path="' + path.relative(dir, path.join(packagePath, '.uses-client.d.ts')) + '" />\n' +
//			'///<reference path="' + path.relative(dir, path.join(packagePath, '.files-client.d.ts')) + '" />\n'
//		);
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

//	console.log('TS cache exists: ' + jsPath + ' ' + fs.existsSync(jsPath));
	if (!fs.existsSync(jsPath) || changeTime.getTime() > fs.statSync(jsPath).mtime.getTime()) {

//		var execSync = Npm.require('exec-sync');
		//var execSync = Npm.require('execSync');
		var exec = Npm.require('child_process').exec;
		var Future = Npm.require('fibers/future');
		function execSync(command) {
			var fut = new Future();
			exec(command, function(error, stdout, stderr){
				fut.return({
					stdout: stdout,
					stderr: stderr || error
				})
			});
			return fut.wait();
		}

		var ERROR = "\nTypeScript compilation failed!\n";
		ERROR = ERROR + (new Array(ERROR.length - 1).join("-")) + "\n";

		//		var compileCommand = 'tsc --nolib --sourcemap --out ' + cacheDir + " " + fullPath; // add client,server module type switch?
//		var compileCommand = 'tsc --target ES5 --sourcemap --outDir ' + cacheDir + ' ' + fullPath;
//		var compileCommand = 'tsc --target ES5 --outDir ' + cacheDir + ' ' + fullPath;
		var compileCommand = 'tsc --target ES5 --outDir ' + cacheDir + ' ' + allPath;
		console.log('Compiling TypeScript...');
//		console.log('Compiling TypeScript... (triggered by ' + path.relative('../', fullPath) + ')');
//		console.log(compileCommand);
		try {
			var result = execSync(compileCommand);
		}
		catch (e) {
			console.log('ERROR');
			console.log(e);
		}


		if (result.stderr) {

			var lines = result.stderr.split('\n');
			var errors = []
			for (var i = 0; i < lines.length; i++) {
				if (!lines[i]) {
					continue;
				}
//				if (
					//					lines[i].trim() &&
					// !/The property '__super__' does not exist on value of type/.test(lines[i]) &&
					//					lines[i].substr(-36) !== 'Base type must be interface or class' &&
					//					lines[i].substr(-30) !== 'not exist in the current scope' &&
					//									lines[i].substr(-24) !== 'lacks an implementation.'
					//				lines[i].indexOf('error TS2095') == -1
//									lines[i].indexOf('error TS2000') == -1  && // Duplicate identifier
//									lines[i].indexOf('error TS2094') == -1 // The property does not exist on value of type
//				) {
					errors.push(lines[i]);
//				}
			}
			if (errors.length > 0) {
				error = ERROR + errors.join('\n');
			}
		}
		if (fs.existsSync(jsPath)) {
//			var sourceBuffer = new Buffer(fs.readFileSync(fullPath));
//			var compiledBuffer = new Buffer(
//				fs.readFileSync(jsPath).toString().replace(
//					/\/\/@ sourceMappingURL=[0-9a-zA-Z_.-]+/,
//					'//@ sourceMappingURL=' + inputPath + '.map?' + changeTime.getTime()
//				)
//			);
//			var mapBuffer = new Buffer(
//				fs.readFileSync(mapPath).toString().replace(
//					/"sources":\["[0-9a-zA-Z-\/\.-]+"]/,
//					'"sources":["' + path.dirname(inputPath) + '/' + path.basename(inputPath) + '?' + changeTime.getTime() + '"]'
//				)
//			);
			if (error) {
				try {
//					fs.unlinkSync(cachePath);
//					fs.unlinkSync(cachePath + '.js');
//					fs.unlinkSync(cachePath + '.map');
					fs.unlinkSync(jsPath);
//					fs.unlinkSync(mapPath);
				}
				catch (e) {
					// ignore
				}
				throw new Error(error);
			}
//			fs.writeFileSync(cachePath, sourceBuffer);
//			fs.writeFileSync(cachePath + '.js', compiledBuffer);
//			fs.writeFileSync(cachePath + '.map', mapBuffer);

//			fs.unlinkSync(jsPath);
//			fs.unlinkSync(mapPath);

		}
		else {
			try {
				fs.unlinkSync(jsPath);
//				fs.unlinkSync(cachePath);
//				fs.unlinkSync(cachePath + '.js');
//				fs.unlinkSync(cachePath + '.map');
			}
			catch (e) {
				// ignore
			}
			if (error) {
				console.log(error);
				throw new Error("Compilation error, aborting.");
			}
			else {
				throw new Error(ERROR + 'file was not created: \n' + compileStep.inputPath + '\n' + jsPath + '\n' + inputPath + '\n' + cacheDir + '\n' + fullPath);
			}
		}

	}
	var data = fs.readFileSync(jsPath).toString();

//	console.log('adding: ' + jsPath)

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