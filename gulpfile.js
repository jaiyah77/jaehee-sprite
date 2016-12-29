'use strict';

// #node modules
const fs          = require('fs');
const gulp        = require('gulp');
const browserSync = require('browser-sync');
const del         = require('del');

const path        = require('path');
// 경로 : path 객체
// 경로에 관련된 모듈은 path라는 이름으로 제공
// path.join([path],[path2],[...]) : 파라미터로 전달받은 경로를 이어 붙여 하나의 경로를 만들어준다
// 파라미터는 원하는 만큼 추가할 수 있으며, 모두 문자열이어야 한다.
// path.join('home','adweb/chiro'); => 'home/adweb/chiro'

const lazypipe = require('lazypipe');


// #gulp modules
const sass        = require('gulp-sass');
// CSS를 구문 분석하고 Can I Use 에 따른 벤더 프리픽스를 CSS 규칙에 추가하는 PostCSS 의  플러그인
const postcss     = require('gulp-postcss'); // css 후처리기
const sourcemaps  = require('gulp-sourcemaps');
const spritesmith = require('gulp.spritesmith');
const cleanCSS    = require('gulp-clean-css');
const prettify    = require('gulp-prettify'); // source formmating
const pug         = require('gulp-pug'); // html 템플릿
const plumber     = require('gulp-plumber'); // 에러 출력 및 watch pipe 깨짐 방지
const gulpif      = require('gulp-if');
// gulp-md5-plus
// md5 는 정적인 파일 (예 : 자바 스크립트, 스타일, 이미지 파일)을 필요하다면 파일 또는 dir 을 두 번째 매개 변수로 전달하여 CSS 또는 html로 파일 이름을 바꿉니다
const md5         = require('gulp-md5-plus');
const handlebars = require('gulp-compile-handlebars');
const rename = require('gulp-rename');

// #notification
const notify = require("gulp-notify"); // 메시지 알림 기능(에러 메시지 등..)

// related postcss modules
const autoprefixer = require('autoprefixer');


var paths = {
	html_src : 'src/templates', // pug,jade 템플릿 엔진
	html_dest : 'src', // 템플릿 엔진을 통해서 컴파일된 html 파일이 생성될 목적지(경로)
	html_path : 'src', // ???
	sprite_src : 'src/sprite/', // 스프라이트 폴더 및 이미지 경로
	sprite_dest : 'src/img/sprite/', // ???
	css_src : 'src/scss/', // scss 파일 경로
	css_dest : 'src/css/', // scss 컴파일된 css 파일이 생성될 목적지(경로) : 프로젝트 폴더 구성시 css 폴더 미리 생성할 필요없음
	img_dest : 'src/img/', // ???
};

var config = {
	pc : false, // pc, mobile 체크
	browserSync : true,
	notify: false, // 운영체제에서 컴파일 결과 알림 기능
	md5 : true, // ???
};

// 1. browserSync task 등록
gulp.task('browserSync', function () {
	/** Static server 에서 사용하는 browserSync 기본 문법
	 * browserSync.init({
            server: {
                baseDir: "./"
            }
       });
	 *
	 * */
	var options = {
		browserSync : {
			server: {
				baseDir: paths.html_path, // 최종 html 경로(or pug 컴파일 html),
				directory: true
			},
			open : 'external'
		}
	};

	// config 에 true 로 설정하면 실행
	if (config.browserSync) {
		browserSync.init(options.browserSync);
		gulp.watch(paths.html_path + '/*.html') // html 을 지속관찰(watch, 응시)하도록 설정
			.on('change', browserSync.reload); //
	}
});

// 2. html task 등록 (pug 컴파일하는 태스크 러너 단독 등록)
gulp.task('template:html', function () {
	var options = {
		pug : {},
		prettify : {
			indent_size : 1,
			indent_char : '\t',
			unformatted : ['pre', 'textarea', 'script']
		}
	};
	return gulp.src(path.join(paths.html_src, '*')) // pug 파일이 존재하는 디렉토리 안의 폴더 및 파일을 하나의 경로로 만듦
		.pipe(pug(options.pug)) // pug 옵션 설정
		.pipe(prettify(options.prettify)) // 컴파일시 소스 포맷팅 설정
		.pipe(gulp.dest(paths.html_dest)); // pug 파일을 컴파일하여 만들어진 html 이 생성된 최종 경로
});

var globalOptions = {
	notify : !config.notify ? {} : { // false 이면 빈 객체로 실행하지 않고 true 라면 에러 메시지 알림 기능 실행
		errorHandler : notify.onError({
			title: '<%= error.relativePath %>',
			message: '<%= error.line %> line - <%= error.messageOriginal %>',
			sound: "Pop"
		})
	}
};

// 3. sass task 등록
gulp.task('sass', function () {
	return gulp.src( path.join(paths.css_src, '*.scss') ) // scss 파일을 읽어온다.
		.pipe(plumber(globalOptions.notify)) // 에러가 나면 pipe 를 연결을 끊지 않고 notify 메시지를 출력한다
		.pipe(sourcemaps.init()) // scss 디버깅을 위해 소스맵을 생성
		.pipe(sassPipe()) // scss 컴파일, 옵션을 실행
		.pipe(sourcemaps.write('./'))
		.pipe(gulp.dest(paths.css_dest)) // 컴파일 대상인 css 를 최종 디렉토리로..
		.pipe(gulpif(config.browserSync, browserSync.stream({match : '**/*.css'}))); // browserSync 가 true 라면 css 를 브라우저 동기화한다.

});

// sass 컴파일 함수
function sassPipe(build) {
	var options = {
		sass : {
			outputStyle: 'expanded',
			indentType: 'tab',
			indentWidth: 1
		},
		autoprefixer: {
			browsers: config.pc ?
				['last 2 versions', "Edge > 0", "ie >= 8"] : // PC 옵션
				["Android > 0","iOS > 0","FirefoxAndroid > 0"] // 모바일 옵션
		}
	};

	options.postcss = [
		autoprefixer(options.autoprefixer)
	];

	// 파이프란 한 프로그램 프로세스에서 다른 프로세스로 정보를 전달하는 기술
	// Lazy Loading 이란?
	// 이미지와 같이 사이즈가 큰 데이터를 로딩할 때 사용자의 브라우져 화면에 나타나지 않은 이미지까지 로딩을 하면 페이지 로딩이 느려질 수 있습니다.
	// lazy loading은 사용자 브라우져에 보이는 이미지만 로딩하고 다른 이미지들은 사용자가 스크롤 하면서 이미지에 가까워지면 로딩됩니다.

	// Lazypipe 를 사용하면 늦게 초기화(lazily-initialized)한 파이프 라인을 만들 수 있습니다.
	// gulp 같이 부분적인 파이프 라인을 재사용하려는 환경에서 사용하기 위한 용도
	var returnPipe = lazypipe().pipe(sass,options.sass); // sass 걸프모듈과 sass 옵션값 전달

	// build 인 매개변수가 참이면
	// lazypipe 를 통해서 sass 옵션을 실하고 postcss 인 후처리를 통해 autoprefiexer 플러그인을 사용하도록 한다.
	if(build) {
		returnPipe = returnPipe.pipe(postcss,options.postcss);
	}

	return returnPipe();
}

function getFolders(dir) {
	return fs.readdirSync(dir)
		.filter(function (file) {
			return fs.statSync(path.join(dir, file)).isDirectory();
		});
}



// 4. sprite task 등록
// => "src/img/sprite/*.png"(병합된 스프라이트 이미지)를 생성 & "src/scss/sprite/*.scss" 인 스프라이트 scss 파일 생성
gulp.task('makeSprite', function () {
	var stream_arr = [];
	var options = {
		// spritesmith 모듈 옵션 정의
		spritesmith: function(folder) {
			return {
				// 컴파일 대상 css 와 'src/img/sprite/' 에 생성된 스프라이트 이미지 연결
				imgPath: path.posix.relative(paths.css_dest, path.posix.join(paths.sprite_dest, 'sp_' + folder + '.png')),
				imgName: 'sp_' + folder + '.png',
				cssName: '_sp_' + folder + '.scss', // 'scss/sprite/*.scss' 파일 생성
				cssFormat: 'scss',
				padding: 10,
				cssTemplate: 'gulpconf/sprite_template.hbs',
				cssSpritesheetName: 'sp_' + folder,
			}
		},
	};

	// paths.sprite_src : 'src/sprite/' 에 스프라이트 제각각(개별이미지사용) 폴더를 생성하면 그 폴더를 로드하여 읽어들인다.
	getFolders(paths.sprite_src).map(function(folder) {
		var spriteData = gulp.src(path.join(paths.sprite_src, folder, '*.png')) // 'src/sprite/' 폴더에 병합된 스프라이트 png 파일 생성
			.pipe(plumber(globalOptions.notify))
			.pipe(spritesmith(options.spritesmith(folder)));

		stream_arr.push(new Promise(function(resolve) {
			spriteData.img
				.pipe(gulp.dest(paths.sprite_dest))
				.on('end',resolve);
		}));

		stream_arr.push(new Promise(function(resolve) {
			spriteData.css
				.pipe(gulp.dest(path.join(paths.css_src, 'sprite')))
				.on('end', resolve);
		}));
	});

	return Promise.all(stream_arr);
});

// sprite 에서 사용할 scss map 생성
gulp.task('makeSpriteMap', ['makeSprite'], function() {
	var options = {
		maps: {
			handlebars: {
				prefix: 'sp_',
				// # 자동생성될 _sprite_maps.scss 에 sprite_maps_template.hbs 에 작성된 Sprites Map import 인 import 구문을 자동 작성한다.
				// ex) @import "../sprite/sp_common.scss";
				path: path.posix.relative(path.posix.join(paths.css_src, 'common'),path.posix.join(paths.css_src, 'sprite')),
				import: getFolders(paths.sprite_src),
				ratio: config.pc ? 1 : 2,
			}
		},
	};

	return gulp.src('gulpconf/sprite_maps_template.hbs')
		.pipe(plumber(globalOptions.notify))
		.pipe(handlebars(options.maps.handlebars))
		.pipe(rename('_sprite_maps.scss'))
		.pipe(gulp.dest(path.join(paths.css_src, 'common')));
});

// #스프라이트 의존 모듈
gulp.task('sprite',['makeSprite','makeSpriteMap']);

gulp.task('md5-sprite', ['makeSprite'], function() {
	var options = {
		md5: {
			cssSrc: path.join(paths.css_src,'sprite/*.scss'), //이름 변경 대상 css(scss) 파일
			srcDel: false, // sprite 이름 변경전 파일 삭제 여부
			logDel: true, // 이전 생성된 md5 sprite 삭제 여부
		}
	};

	if(config.md5) {
		var del_sprite = [];
		var sprite_list = getFolders(paths.sprite_src);
		for (var i = 0, imax = sprite_list.length; i < imax; i++) {
			del_sprite.push(path.join(paths.sprite_dest, 'sp_' + sprite_list[i] + '_????????.png'));
			sprite_list[i] = path.join(paths.sprite_dest, 'sp_' + sprite_list[i] + '.png');
		}

		return del(del_sprite)
			.then(new Promise(function(resolve) {
				gulp.src(sprite_list)
					.pipe(plumber(globalOptions.notify))
					.pipe(md5(8,options.md5.cssSrc))
					.pipe(gulp.dest(paths.sprite_dest))
					.on('end',resolve);
			})).then(function() {
				if(options.md5.srcDel) {
					return del(sprite_list);
				}
			});
	}
});

// css 배포시 task 등록
gulp.task('sass-build', ['sprite','md5-sprite'], function() {
	return Promise.all([
		del(path.join(paths.css_dest,'**/*.css.map')),
		new Promise(function(resolve) {
			gulp.src(path.join(paths.css_src, '**/*.scss'))
				.pipe(plumber(globalOptions.notify))
				.pipe(sassPipe(true))
				.pipe(gulp.dest(paths.css_dest))
				.on('end',resolve);
		})
	]);
});

gulp.task('minify', [], function() {
	var options = {
		cleanCSS: {
			'advanced' : false,           // 속성 병합 false
			'aggressiveMerging': false,   // 속성 병합 false
			'restructuring': false,       // 선택자의 순서 변경 false
			'mediaMerging': false,        // media query 병합 false
			'compatibility': 'ie7,ie8,*', // IE 핵 남김
		}
	};
	return gulp.src(path.join(paths.css_dest, '*.css'))
		.pipe(cleanCSS(options.cleanCSS))
		.pipe(gulp.dest(paths.css_dest));
});



// 지속적인 관찰이 필요한 task 를 등록
gulp.task('watch', ['sass', 'sprite'],function () {
	var options = {};
	gulp.watch([path.join(paths.html_src, '/**/*')], ['template:html']); // html 템플릿(pug)과 html task 를 지속 관찰시킴
	gulp.watch([path.join(paths.css_src, '/**/*')], ['sass']);
	gulp.watch([path.join(paths.sprite_src, '/**/*')], ['sprite']);
});

// 지속적으로 관찰하는 업무와 웹서버 리로드인 browserSync 를 gulp 명령어를 실행하면 모두 실행하도록 등록
gulp.task('default', ['watch', 'browserSync']);


gulp.task('dev', ['sass','sprite']);
gulp.task('build', ['sass-build','sprite','md5-sprite']);