'use strict';

/* exported setup, keyPressed, keyReleased */

var cpu;
var vga;
var blinkenLights;
var audio;
var gamepad;
var perf;

/** Performance Monitor */
class Perf {
	/** Create a Performance Monitor
	 * @param {Element} elt - The element in which to display performance
	 */
	constructor(elt) {
		this.elt = elt;
		this.cycles = 0;
		this.startTime = Date.now();
	}

	/** advance simulation by one tick */
	tick() {
		if (this.cycles++ > 6250000) {
			let endTime = Date.now();
			let mhz = this.cycles / (1000 * (endTime-this.startTime));
			this.elt.textContent = mhz.toFixed(3) + 'MHz';
			this.startTime = endTime;
			this.cycles = 0;
		}
	}
}

function toHex(value, width) {
	let s = value.toString(16);
	if (s.length < width) {
		s = '0'.repeat(width-s.length) + s;
	}
	return s;
}

/** p5 setup function */
window.onload = function setup() {
	let mhzText = document.getElementById('mhz');
	let runButton = document.getElementById('run');
	let stepButton = document.getElementById('step');
	let resetButton = document.getElementById('reset');
	let loadButton = document.getElementById('load');
	let muteButton = document.getElementById('mute');
	let volumeSlider = document.getElementById('volume');
	let volumeLabel = document.getElementById('volume-label');
	let vgaCanvas = document.getElementById('vga');
	let blinkenLightsCanvas = document.getElementById('blinken-lights');
	let romFileInput = document.getElementById('rom-file');
	let pcSpan = document.getElementById('reg-pc');
	let nextpcSpan = document.getElementById('reg-nextpc');
	let acSpan = document.getElementById('reg-ac');
	let xSpan = document.getElementById('reg-x');
	let ySpan = document.getElementById('reg-y');
	let outSpan = document.getElementById('reg-out');
	let outxSpan = document.getElementById('reg-outx');

	//noLoop();

	perf = new Perf(mhzText);

	cpu = new Gigatron({
		log2rom: 16,
		log2ram: 15,
	});

	vga = new Vga(vgaCanvas, cpu, {
		horizontal: {frontPorch: 16, backPorch: 48, visible: 640},
		vertical: {frontPorch: 10, backPorch: 34, visible: 480},
	});

	blinkenLights = new BlinkenLights(blinkenLightsCanvas, cpu);

	audio = new Audio(cpu);

	gamepad = new Gamepad(cpu, {
		up: 'ArrowUp',
		down: 'ArrowDown',
		left: 'ArrowLeft',
		right: 'ArrowRight',
		select: 'q',
		start: 'w',
		a: 'a',
		b: 's',
	});

	let gdb = {
		timer: null,
	};

	function updateRegs() {
		pcSpan.textContent = '$'+toHex(cpu.pc, 4);
		nextpcSpan.textContent = '$'+toHex(cpu.nextpc, 4);
		acSpan.textContent = '$'+toHex(cpu.ac, 2);
		xSpan.textContent = '$'+toHex(cpu.x, 2);
		ySpan.textContent = '$'+toHex(cpu.y, 2);
		outSpan.textContent = '$'+toHex(cpu.out, 2);
		outxSpan.textContent = '$'+toHex(cpu.out, 2);
	}

	updateRegs();

	let loader = new Loader(cpu);
	loadButton.onclick = function() { load(loader); };

	resetButton.onclick = function() {
		cpu.reset();
		updateRegs();
	};

	runButton.onclick = function() {
		if (gdb.timer) {
			clearTimeout(gdb.timer);
			gdb.timer = null;
			this.textContent = 'Go';
			this.classList.replace('btn-danger', 'btn-success');
			updateRegs();
		}
		else {
			gdb.timer = setInterval(ticks, audio.duration);
			this.textContent = "Stop";
			this.classList.replace('btn-success', 'btn-danger');
		}
	};

	stepButton.onclick = function() {
		perf.tick();
		cpu.tick();
		vga.tick();
		blinkenLights.tick();
		updateRegs();
	};

	muteButton.onclick = function() {
		audio.mute = !audio.mute;
		if (audio.mute) {
			this.textContent = 'Unmute';
			this.classList.replace('btn-danger', 'btn-success');
		}
		else {
			this.textContent = 'Mute';
			this.classList.replace('btn-success', 'btn-danger');
		}
	};

	volumeSlider.oninput = function() {
		volumeLabel.textContent = this.value+'%';
		audio.volume = this.value / 100;
	};

	romFileInput.onchange = function() {
		let file = this.files[0];
		this.labels[0].textContent = file.name;
		let fileReader = new FileReader();
		fileReader.onload = function() {
			let buffer = this.result;
			let n = buffer.byteLength >> 1;
			let view = new DataView(buffer);
			for (let i = 0; i < n; i++) {
				cpu.rom[i] = view.getUint16(i<<1);
			}
			cpu.romMask = file.size-1;
		};
		fileReader.readAsArrayBuffer(file);
	};
};

/** load blinky program
 * @param {Loader} loader
*/
function load(loader) {
	console.log('Loading');

	/* eslint-disable no-multi-spaces, max-len */
	loader.load({
		startAddress: 0x7f00,
		blocks: [
			{
				address: 0x7f00,
				bytes: [
					0x11, 0x50, 0x44, // 7f00 LDWI $4450  ; Load address of center of screen
					0x2b, 0x30,       // 7f03 STW  'p'    ; Store in variable 'p' (at $0030)
					0xf0, 0x30,       // 7f05 POKE 'p'    ; Write low byte of accumulator there
					0xe3, 0x01,       // 7f07 ADDI 1      ; Increment accumulator
					0x90, 0x03,       // 7f09 BRA  $7f05  ; Loop forever
                            // 7f0b
				],
			},
		],
	});
	/* eslint-enable no-multi-spaces, max-len */

	console.log('Loaded');
}

/** advance the simulation by many ticks */
function ticks() {
	let cycles = 0;
	while (cycles++ < 625000 && audio.scheduled < 4) {
		perf.tick();
		cpu.tick();
		vga.tick();
		audio.tick();
	}
	blinkenLights.tick();
	audio.drain();
}