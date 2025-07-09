import Display from "./Display.ts";

const stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding("utf8");

const display = new Display();

stdin.on("data", (key) => {
	const keyString = key.toString();
	switch (keyString) {
		case "\u0003":
		case "q": {
			// ctrl-c
			Display.clearScreen();
			return process.exit();
		}
		case "c": {
			Display.clearScreen();
			break;
		}
		case "t": {
			display.populateTest();
			display.writeFrame();
			break;
		}
		default: {
			if (keyString.length == 3) {
				switch (keyString.charCodeAt(2)) {
					case 65: {
						// Up
						const selectedIndex = display.left.findIndex((i) => i.selected);
						if (selectedIndex > 0) {
							const current = display.left[selectedIndex];
							const previous = display.left[selectedIndex - 1];
							if (current == undefined) throw new Error("Current undefined!");
							if (previous == undefined) throw new Error("Previous undefined!");
							current.selected = false;
							previous.selected = true;
							display.writeFrame();
						}
						break;
					}
					case 66: {
						// Down
						const selectedIndex = display.left.findIndex((i) => i.selected);
						if (selectedIndex < display.left.length - 1) {
							const current = display.left[selectedIndex];
							const next = display.left[selectedIndex + 1];
							if (current == undefined) throw new Error("Current undefined!");
							if (next == undefined) throw new Error("Next undefined!");
							current.selected = false;
							next.selected = true;
							display.writeFrame();
						}
						break;
					}
				}
			}
		}
	}
});

process.stdout.on("resize", () => {
	display.writeFrame();
});
