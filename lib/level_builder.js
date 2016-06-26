var Door = require('./door.js');
var Elevator = require('./elevator.js');
var ExitElevator = require('./exitElevator.js');
var ButtonBlock = require('./buttonBlock.js');
var Cubby = require('./cubby.js');
var Wire = require('./wire.js');
var WireJunction = require('./wireJunction.js');
var PowerSource = require('./powerSource.js');
var ForceFieldBlock = require('./forceFieldBlock.js');
var Panel = require('./panel.js');
var Spring = require('./spring.js');

function Level(name, foregroundGrid, backgroundGrid, robotPos, elevators, doors, cubbies, wiring, powerSources, forceFieldBlocks, buttonBlocks) {
  this.name = name;
  this.foregroundGrid = foregroundGrid;
  this.backgroundGrid = backgroundGrid;
  this.startingPos = robotPos;
  this.elevators = elevators;
  this.doors = doors;
  this.cubbies = cubbies;
  this.wiring = wiring;
  this.powerSources = powerSources;
  this.forceFieldBlocks = forceFieldBlocks;
  this.buttonBlocks = buttonBlocks;
}

function LevelBuilder() {};

LevelBuilder.prototype.rowOf = function (rowLength, something) {
  var rowArray = [];
  for (var i = 0; i < rowLength; i++) {
    rowArray.push(something);
  }
  return rowArray;
};

module.exports = {
  Level: Level,
  LevelBuilder: LevelBuilder,
  Door: Door,
  Elevator: Elevator,
  ExitElevator: ExitElevator,
  ButtonBlock: ButtonBlock,
  Cubby: Cubby,
  Wire: Wire,
  WireJunction: WireJunction,
  PowerSource: PowerSource,
  ForceFieldBlock: ForceFieldBlock,
  Panel: Panel,
  Spring: Spring
};