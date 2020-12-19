import fs from "fs";
import path from "path";

/**
 * The main function of bandsaw, to autotrim png images, rewrite original file, and return data about our crop.
 *
 * @param {Array|String} list An array of filepaths or string to filepaths (png file or folder)
 * @param {Number} padding A number to arbitrarily expand cropping bounds to prevent 1px clipping discrepancy
 *
 * @returns {Array} Array of verbose objects containing all offset, rect, path, and name information for each entry
 */
async function trim(list, padding = 0) {
  //
  // Ensure the input is a typeof Array so we can return the same output format regardless
  if (!Array.isArray(list) || /string/i.test(typeof list)) list = [list];
  //
  // Ensure padding is a number and not a string
  padding = +padding;
  if (isNaN(padding))
    console.error(
      `Padding of ${padding} [${typeof padding}] is not typeof Number`
    );
  //
  // Filter out any filepaths to non-existant files
  list = list.filter((item) => {
    return exists(item);
  });
  //
  // If this entry is a path to a folder, unfold it and get the children contents
  let index = -1;
  for (let item of list) {
    index++;
    if (isFolder(item)) list[index] = await readDir(item);
  }
  //
  // Then flatten all entries and filter out anything that isn't a png file
  list = list.flat().filter((item) => {
    return /\.png$/.test(item);
  });
  //
  // If we don't have any entries left, we return early
  if (!list.length) return list;
  //
  // Otherwise we await the result of a trim on every item within
  return await Promise.all(
    list.map((item) => {
      return trimItem(item, padding);
    })
  );
}

/**
 * The utility function to trim a single object
 *
 * @param {String} targFile Absolute filepath to the target png image
 * @param {Number} padding A number to arbitrarily expand cropping bounds to prevent 1px clipping discrepancy
 *
 * @returns {Promise} Object with verbose information about clipping operation
 */
function trimItem(targFile, padding) {
  return new Promise((resolve, reject) => {
    try {
      //
      // Create a temporary, hidden canvas HTML element
      const canvas = document.createElement("canvas");
      //
      // Gather data about image, dimensions, and set canvas to paint at fullsize
      let base64 = encodeAsBase64(targFile);
      const dims = getPngDimensions(base64);
      canvas.width = dims.width;
      canvas.height = dims.height;
      //
      // Get drawing context, then set source.src to base64 dynamically
      const context = canvas.getContext("2d");
      const img = new Image();
      img.onload = function () {
        //
        // This gets called after the src overwrite. Paint the image with our data
        context.drawImage(this, 0, 0, canvas.width, canvas.height);
        //
        // Iterate through every pixel to get bounds, create a new canvas for bounds,
        // paint with the new bounds, then remove the canvas copy and overwrite file
        let result = trimCanvas(canvas, targFile, padding);
        //
        // Remove our temporary canvas and resolve
        canvas.remove();
        resolve(result);
      };
      img.src = `data:image/png;base64,${base64}`;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * The utility for iterating over pixel data and actually clipping/rewriting the file
 *
 * @param {Canvas} canvas The painted temporary canvas of target PNG image
 * @param {String} filepath Absolute filepath to target
 * @param {Number} padding A number to arbitrarily expand cropping bounds to prevent 1px clipping discrepancy
 *
 * @returns {Object} Detailed clipping operation information
 */
function trimCanvas(canvas, filepath, padding) {
  //
  // Create a new, temporary copy of the canvas and initiate require variables.
  // (Since we never append it to HTML body, we don't need to overwrite any styles)
  let context = canvas.getContext("2d"),
    pixels = context.getImageData(0, 0, canvas.width, canvas.height),
    temp = document.createElement("canvas").getContext("2d"),
    l = pixels.data.length,
    i,
    bound = {
      top: null,
      left: null,
      right: null,
      bottom: null,
    },
    x,
    y;
  //
  // Now iterate through every line of pixels and detect where our crop bounds should be
  for (i = 0; i < l; i += 4)
    if (pixels.data[i + 3] !== 0) {
      x = (i / 4) % canvas.width;
      y = ~~(i / 4 / canvas.width);
      bound.top = bound.top === null ? y : bound.top;
      bound.left = bound.left === null || x < bound.left ? x : bound.left;
      bound.right = bound.right === null || bound.right < x ? x : bound.right;
      bound.bottom =
        bound.bottom === null || bound.bottom < y ? y : bound.bottom;
    }
  //
  // Attempt to add padding to all sides
  Object.keys(bound).forEach((key) => {
    bound[key] = /left|top/.test(key)
      ? bound[key] - padding
      : bound[key] + padding;
  });
  //
  // Ensure that the padding never exceeds width/height parameters or is below 0
  Object.keys(bound).forEach((key) => {
    bound[key] = clamp(
      bound[key],
      0,
      /left|right/i.test(key) ? canvas.width : canvas.height
    );
  });
  //
  // Get the cropbox rect from our detected bounds and get new 2D context data from it
  let trimHeight = bound.bottom - bound.top,
    trimWidth = bound.right - bound.left,
    trimmed = context.getImageData(
      bound.left,
      bound.top,
      trimWidth,
      trimHeight
    );
  //
  // Set our copy canvas dimensions to crop box, then paint a new cropped image
  temp.canvas.width = trimWidth;
  temp.canvas.height = trimHeight;
  temp.putImageData(trimmed, 0, 0);
  //
  // Overwrite the original file with the new cropped image data
  fs.writeFileSync(
    filepath,
    new Buffer(
      temp.canvas.toDataURL().replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    )
  );
  //
  // Then remove the duplicate canvas and resolve with all relevant data
  temp.canvas.remove();
  return {
    name: filepath
      .split(/(\/|\\)/)
      .pop()
      .replace(/\.png$/, ""),
    fullName: filepath.split(/(\/|\\)/).pop(),
    path: filepath,
    left: bound.left,
    top: bound.top,
    right: canvas.width - bound.right,
    bottom: canvas.height - bound.bottom,
    width: bound.right - bound.left,
    height: bound.bottom - bound.top,
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
    geometricBounds: [bound.left, bound.top, bound.right, bound.bottom],
  };
}
//
// Retrieves width and height dimensions from a base64 string
function getPngDimensions(base64) {
  const header = atob(base64.slice(0, 50)).slice(16, 24);
  const uint8 = Uint8Array.from(header, (c) => c.charCodeAt(0));
  const dataView = new DataView(uint8.buffer);
  return {
    width: dataView.getInt32(0),
    height: dataView.getInt32(4),
  };
}
//
// Shorthand to return boolean when between two values instead of needing greater/less than conditionals
function isBetween(value, min, max) {
  return (!min && min !== 0) || (!max && max !== 0) || arguments.length < 3
    ? false
    : value >= min && value <= max;
}
//
// Inspired by AEFT's clamp() global method, returns the value between min / max without exceeding either
function clamp(value, min, max) {
  if (isBetween(value, min, max)) return value;
  else if (value < min) return min;
  else if (value > max) return max;
}
//
// Returns base64 data from any PNG filepath
function encodeAsBase64(filepath) {
  return new Buffer(fs.readFileSync(filepath)).toString("base64");
}
//
// Returns boolean to ensure a filepath actually exists
function exists(targetPath) {
  return fs.existsSync(path.resolve(targetPath));
}
//
// Returns boolean to know if the filepath should be expanded to children content
function isFolder(targetPath) {
  return fs.lstatSync(path.resolve(targetPath)).isDirectory();
}
//
// Returns the contents of a folder as an Array of absolute filepaths
async function readDir(targetPath) {
  return new Promise((resolve, reject) => {
    if (!exists(targetPath) || !isFolder(targetPath))
      reject("Path is not a folder or does not exist");
    fs.readdir(
      path.resolve(targetPath),
      { encoding: "utf-8" },
      (err, files) => {
        if (err) reject(err);
        resolve(
          files.map((item) => {
            return `${targetPath}/${item}`;
          })
        );
      }
    );
  });
}

export default {
  trim: trim,
};
