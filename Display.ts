const MARGIN_VERTICAL = 2;
const MARGIN_HORIZONTAL = 4;
const GUTTER = 4;

export default class Display {
	left: { content: string; selected: boolean; bold: boolean }[];
	right: {
		content: string;
		formatting?: string[];
		wrap?: boolean;
		center?: boolean;
		justify?: boolean;
	}[];
	bottom: string[];

	constructor() {
		this.left = [];
		this.right = [];
		this.bottom = [];
	}

	populateTest() {
		this.left = [];
		this.right = [];
		this.bottom = ["[ c Clear ]", "[ t Test ]", "[ q Quit ]"];
		for (let i = 0; i < 100; i++) {
			this.left.push({
				content: `Video ${i} - Random stuff here blablablablablakfjasldkfjasldkjf`,
				selected: i == 0,
				bold: i < 10
			});
		}
		this.right.push({
			content: "This Video Has The Best Title",
			formatting: ["\u001B[1m"],
			center: true
		});
		this.right.push({
			content: "Rossmann Koi Group\t1:69:44",
			formatting: ["\u001B[3;31m", "\u001B[33m"],
			justify: true
		});
		this.right.push({
			content: "8 Hours Ago",
			formatting: ["\u001B[32m"],
			center: true
		});
		this.right.push({
			content: "",
			formatting: []
		});
		this.right.push({
			content:
				"This is the biggest fucking description anyone's ever written.\n\nI want it to wrap all around the page several times.\n\nDon't forget to click all the links in the description and do all of the random shit because we want your money.",
			formatting: [],
			wrap: true
		});
	}

	writeFrame() {
		let stdout = Display.clearScreenText;
		function write(str: string) {
			stdout = `${stdout}${str}`;
		}
		const width = process.stdout.columns;
		const height = process.stdout.rows;
		let rightWrapIndex = 0;

		for (let row = 0; row < height; row++) {
			let col = 0;
			if (row == height - MARGIN_VERTICAL - 1) {
				// Bottom row
				for (; col < MARGIN_HORIZONTAL; col++) {
					write(" ");
				}
				let bottomContent = "";
				let tmpCol = col;
				for (let i = 0; i < this.bottom.length; i++) {
					let item = this.bottom[i];
					if (i > 0) item = ` ${item}`;
					if (
						item == undefined ||
						tmpCol + item.length > width - MARGIN_HORIZONTAL - 1
					)
						break;
					bottomContent = `${bottomContent}${item}`;
					tmpCol += item.length;
				}
				bottomContent = bottomContent.trim();
				const extra = width - 2 * MARGIN_HORIZONTAL - bottomContent.length;
				const padding = Math.floor(extra / 2);
				for (let i = 0; i < padding; i++) {
					write(" ");
					col++;
				}
				write(`${bottomContent}\n`);
			} else if (
				row < MARGIN_VERTICAL ||
				(row > height - (2 * MARGIN_VERTICAL + 2) && row < height - 1)
			) {
				write("\n");
			} else if (row == height - 1) {
				// Last margin row; nothing needs printing here
			} else {
				// Content row
				for (; col < MARGIN_HORIZONTAL; col++) {
					write(" ");
				}
				// Left content
				const leftItem = this.left[row - MARGIN_VERTICAL];
				const leftSpace =
					Math.floor((width - 2 * MARGIN_HORIZONTAL) / 2) - GUTTER / 2 - 4;
				if (leftItem?.selected) {
					write("\u001B[1;97m>\u001B[0m \u001B[4m");
				} else {
					write("  ");
				}
				col += 2;
				if (leftItem?.bold) {
					write("\u001B[1;97m");
				}
				for (let i = 0; i < leftSpace; i++) {
					if (
						leftItem != undefined &&
						i == leftSpace - 1 &&
						leftItem.content.length > leftSpace
					) {
						write("\u2026");
					} else if (i == leftItem?.content.length) {
						write("\u001B[0m ");
					} else {
						write(leftItem?.content[i] ?? " ");
					}
					col++;
				}
				if (leftItem?.selected || leftItem?.bold) {
					write("\u001B[0m");
				}
				if (leftItem?.selected) {
					write(" \u001B[1;97m<\u001B[0m");
				} else {
					write("  ");
				}
				col += 2;

				// Gutter
				for (let i = 0; i < GUTTER; i++) {
					write(" ");
					col++;
				}

				// Right content
				let rightItem = this.right[row - MARGIN_VERTICAL];
				if (rightItem == undefined && this.right[this.right.length - 1]?.wrap) {
					rightItem = this.right[this.right.length - 1];
				}
				if (
					rightItem != undefined &&
					(!rightItem.wrap || rightWrapIndex < rightItem.content.length)
				) {
					const rightSpace =
						Math.floor((width - 2 * MARGIN_HORIZONTAL) / 2) - GUTTER / 2;
					if (rightItem.justify) {
						const formattingOne = rightItem.formatting?.[0];
						const formattingTwo = rightItem.formatting?.[1];
						if (formattingOne != undefined) {
							write(formattingOne);
						}
						for (let i = 0; i < rightSpace; i++) {
							if (col >= width - MARGIN_HORIZONTAL) break;
							if (rightItem.content[i] == "\t") {
								write("\u001B[0m");
								const spaceRemaining = width - MARGIN_HORIZONTAL - col;
								const padding =
									spaceRemaining - (rightItem.content.split("\t")[1]?.length ?? 0);
								if (padding > 0) {
									for (let j = 0; j < padding; j++) {
										write(" ");
										col++;
									}
								}
								if (formattingTwo != undefined) {
									write(formattingTwo);
								}
							} else {
								write(rightItem.content[i] ?? " ");
								col++;
							}
						}
					} else {
						const formattingOne = rightItem.formatting?.[0];
						if (formattingOne != undefined) {
							write(formattingOne);
						}
						if (rightItem.center) {
							const padding = Math.floor((rightSpace - rightItem.content.length) / 2);
							for (let i = 0; i < padding; i++) {
								write(" ");
								col++;
							}
						}
						if (rightItem.wrap) {
							let newline = false;
							for (let i = 0; i < rightSpace; i++) {
								if (col >= width - MARGIN_HORIZONTAL) break;
								const char = rightItem.content[i + rightWrapIndex];
								if (char == "\n") {
									newline = true;
									rightWrapIndex += i + 1;
									break;
								}
								write(char ?? " ");
								col++;
							}
							if (!newline) {
								rightWrapIndex += rightSpace;
							}
						} else {
							for (let i = 0; i < rightSpace; i++) {
								if (col >= width - MARGIN_HORIZONTAL) break;
								write(rightItem.content[i] ?? " ");
								col++;
							}
						}
					}
					write("\u001B[0m");
				}
				write("\n");
			}
		}
		process.stdout.write(stdout);
	}

	static get clearScreenText() {
		return "\u001B[2J\u001B[3J\u001B[0;0f";
	}

	static clearScreen() {
		process.stdout.write(Display.clearScreenText);
	}
}
