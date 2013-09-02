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
	packageRefs[packageName].forEach(function (entry) {
		res += '///<reference path="' + path.relative(dir, entry) + '" />\n';
	});
	return res;
}

function getAllPackageRefs(src, dir) {
	var res = "";
	fs.readdirSync(src).forEach(function (entry) {
		if (entry.substring(0, 1) === '.') {
			return;
		}
		var packagePath = path.join(src, entry, '.ref.d.ts');
		if (!fs.existsSync(packagePath)) {
			return;
		}
		res += '///<reference path="' + path.join(entry, '.package.d.ts') + '" />\n';
	});
	return res;
}

function getAppRefs() {
	var res = '///<reference path=".packages.d.ts" />\n';
	appRefs.forEach(function (entry) {
		res += '///<reference path="' + path.relative('.meteor', entry) + '" />\n';
	});
	return res;
}

var handler = function (compileStep) {
	//console.log('COMPILING: ' + compileStep._fullInputPath);

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
		var meteorPath = compileStep._fullInputPath.substring(
			0,
			compileStep._fullInputPath.length -
			compileStep.inputPath.length -
			compileStep.rootOutputPath.length
		)  + 'packages';
		if (!packageRefs[compileStep.packageName]) {
			packageRefs[compileStep.packageName] = [];
		}
		if (!packageDirs[compileStep.packageName]) {
			packageDirs[compileStep.packageName] = [];
		}

		var packDirs = packageDirs[compileStep.packageName];
		var packRefs = packageRefs[compileStep.packageName];

		if (packDirs.indexOf(dir) == -1) {
			packDirs.push(dir);
		}
		if (packRefs.indexOf(fullPath) == -1) {
			var packagePath = path.join(meteorPath, compileStep.packageName);
			var packageDef = path.join(packagePath, '.package.d.ts');
			var allPackageDef = path.join(meteorPath, '.packages.d.ts');
			packRefs.push(fullPath);
			fs.writeFileSync(allPackageDef, getAllPackageRefs(meteorPath, meteorPath));
			packDirs.forEach(function (dir) {
				fs.writeFileSync(path.join(dir, '.ref.d.ts'), '///<reference path="' + path.relative(dir, allPackageDef) + '" />\n');
			});
			fs.writeFileSync(packageDef, getPackageRefs(packagePath, compileStep.packageName));
			fs.writeFileSync(path.join('.meteor', '.packages.d.ts'), '///<reference path="' + path.relative('.meteor', allPackageDef) + '" />\n');
		}
	}
	else {
		if (appDirs.indexOf(dir) == -1) {
			appDirs.push(dir);
		}
		if (appRefs.indexOf(fullPath) == -1) {
			appRefs.push(fullPath);
			appDirs.forEach(function (dir) {
				fs.writeFileSync(dir + "/.ref.d.ts", '///<reference path="' + path.relative(dir, '.meteor/.app.d.ts') + '" />\n');
			});
			fs.writeFileSync('.meteor/.app.d.ts', getAppRefs());
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
		// XXX Use other npm packages. Seen in the handlebars package ;)

		var compileCommand = 'tsc --target ES5 --sourcemap --outDir ' + cacheDir + ' ' + fullPath; // add client,server module type switch?
		//console.log(compileCommand);

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
			var mapBuffer = new Buffer(
				fs.readFileSync(mapPath).toString().replace(
					/"sources":\["[0-9a-zA-Z-\/\.-]+"]/,
					'"sources":["' + path.dirname(inputPath) + '/' + path.basename(inputPath) + '?' + changeTime.getTime() + '"]'
				)
			);
//			console.log('1: ' + jsPath);
			if (error) {
				try {
					fs.unlinkSync(cachePath, sourceBuffer);
					fs.unlinkSync(cachePath + '.js', compiledBuffer);
					fs.unlinkSync(cachePath + '.map', mapBuffer);
					fs.unlinkSync(jsPath);
					fs.unlinkSync(mapPath);
				}
				catch (e) {
					// ignore
				}
				throw new Error(error);
			}
			fs.writeFileSync(cachePath, sourceBuffer);
			fs.writeFileSync(cachePath + '.js', compiledBuffer);
			fs.writeFileSync(cachePath + '.map', mapBuffer);

			fs.unlinkSync(jsPath);
			fs.unlinkSync(mapPath);

		}
		else {
			try {
				fs.unlinkSync(cachePath, sourceBuffer);
				fs.unlinkSync(cachePath + '.js', compiledBuffer);
				fs.unlinkSync(cachePath + '.map', mapBuffer);
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

	if (error) {
		throw new Error(error);
	}
};

Plugin.registerSourceHandler("ts", handler);