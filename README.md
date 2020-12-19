# bandsaw

[![NPM](https://nodei.co/npm/bandsaw.png)](https://npmjs.org/package/bandsaw)

By user request for [Timelord](https://www.battleaxe.co/timelord), a simple spellbook for auto-cropping PNGs.

![](./logo.png)

## Installation

```bash
npm install bandsaw
```

## Use

```js
let result = await bandsaw.trim(input, padding);
```

<br />

---

<br />

## trim(input[, padding?])

The main function of bandsaw: to autotrim png images, rewrite original files, and return verbose data about our crop for accurate positioning from PS to AE.

| Param   | Type     | Default |                                                                                                                              Description |
| :------ | :------- | :------ | ---------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| input   | `Array   | String` |                                                                                                                                   `null` | An `Array` of absolute filepaths or a single `String` to either a file or folder. When a folder is provided, `trim()` will act on all it's contents (but only for PNGs). |
| padding | `Number` | `0`     | A `Number` to extend the cropbox on every side (e.g., `5` will extend 5px in each direction, resulting in +10px width and height total). |

---

## Examples

### Input examples

- Sending a single file:

```js
let result = await bandsaw.trim("C:/Users/TRSch/OneDrive/testImage.png");
console.log(result); // Returns Array with length of 1
```

- Sending multiple files:

```js
let files = [
  "C:/Users/TRSch/OneDrive/test1.png",
  "C:/Users/TRSch/OneDrive/test2.png",
];
let result = await bandsaw.trim(files);
console.log(result); // Returns Array with length of 2
```

- Running on entire folder contents:

```js
let result = await bandsaw.trim("C:/Users/TRSch/OneDrive/testFolder");
console.log(result); // Returns Array with length equal to amount of PNG files inside folder
```

- Files and folders:

```js
let files = [
  "C:/Users/TRSch/OneDrive/test1.png",
  "C:/Users/TRSch/OneDrive/testFolder",
];
let result = await bandsaw.trim(files);
console.log(result); // Returns Array with length of 2
```

---

### Output examples

When using a folder as input:

```js
let result = await bandsaw.trim("C:/Users/TRSch/Downloads/test");
```

Output `result` becomes:

```js
[
  {
    name: "fileA",
    fullName: "fileA.png",
    path: "C:/Users/TRSch/Downloads/test/fileA.png",
    left: 132, // distances from original edges to corresponding crop edges
    top: 172,
    right: 133,
    bottom: 109,
    width: 735, // dimensions of the crop and new file, not the original
    height: 719,
    naturalWidth: 1000, // dimensions of the original
    naturalHeight: 1000,
    geometricBounds: [132, 172, 867, 891], // [x1, y1, x2, y2] coordinates of cropbox from original file
  },
  {
    name: "fileB",
    fullName: "fileB.png",
    path: "C:/Users/TRSch/Downloads/test/fileB.png",
    left: 5,
    top: 63,
    right: 4,
    bottom: 69,
    width: 555,
    height: 432,
    naturalWidth: 564,
    naturalHeight: 564,
    geometricBounds: [5, 63, 560, 495],
  },
];
```

When `padding` is defined, the cropbox will be expanded and all values within output will be expanded to reflect:

```js
let noPadding = await bandsaw.trim(
  "C:/Users/TRSch/Downloads/test/NoPadding.png"
);

// Here we include 10 for padding
let includePadding = await bandsaw.trim(
  "C:/Users/TRSch/Downloads/test/IncludePadding.png",
  10
);

// Merge results to see them side by side
let result = [].concat(noPadding, includePadding);

console.log(result);
```

We see the difference between their values here, where `IncludePadding.png` has compensated bounds to prevent any accidental loss discrepancies:

```js
[
  {
    name: "NoPadding",
    fullName: "NoPadding.png",
    path: "C:/Users/TRSch/Downloads/test/NoPadding.png",
    left: 142,
    top: 182,
    right: 143,
    bottom: 119,
    width: 715,
    height: 699,
    naturalWidth: 1000,
    naturalHeight: 1000,
    geometricBounds: [142, 182, 857, 881],
  },
  {
    name: "IncludePadding",
    fullName: "IncludePadding.png",
    path: "C:/Users/TRSch/Downloads/test/IncludePadding.png",
    left: 132,
    top: 172,
    right: 133,
    bottom: 109,
    width: 735,
    height: 719,
    naturalWidth: 1000,
    naturalHeight: 1000,
    geometricBounds: [132, 172, 867, 891],
  },
];
```

# Notes

- Pixel detection is close but not perfect. I notice with exporting parametric shapes, I often get the top/left params exactly correct, but often lose a pixel on right/bottom during crop, where a 100x100 rectangle @{x: 50, y: 50} will return left: 50 and top: 50 correctly but crop as 99x99. We may want to add `1` as padding to prevent this single pixel loss inside Timelord
