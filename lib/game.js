import Robot from './robot.js';
import Renderer from './renderer.js';
import Wire from './wire.js';
const BLOCK_LENGTH = 75;

class Game {

  constructor(renderer, levelSequence) {
    this.renderer = renderer;
    this.BLOCK_LENGTH = 75;
    this.levelSequence = levelSequence;
    this.origin = [0, 0];
    this.keysDown = {};
    this.spaceTime = 0;
    this.mainLoopRunning = false;
    this.tutorialPage = 0;
  }

  startGame() {
    this.status = "loading";
    this.renderer.displayLoadScreen();
  }

  showMainMenu() {
    this.status = "menu";
    this.renderer.displayMenu();
  }

  startLevel() {
    this.currentLevel = this.levelSequence[0];
    if (this.currentLevel.name) {
      this.renderer.showLevelName = true;
      let flashN = 5;
      let levelFlash = window.setInterval(() => {
        flashN = this.renderer.toggleLevelName(flashN);
        if (flashN === 0) {
          clearInterval(levelFlash);
        }
      }, 600);
    }
    this.levelWidth = this.currentLevel.backgroundGrid[0].length * this.BLOCK_LENGTH;
    this.levelHeight = this.currentLevel.backgroundGrid.length * this.BLOCK_LENGTH;
    if (this.currentLevel.backgroundGrid.length !== this.currentLevel.foregroundGrid.length ||
      this.currentLevel.backgroundGrid[0].length !== this.currentLevel.foregroundGrid[0].length) {
        throw "foregroundGrid and backgroundGrid dimensions don't match!";
    }

    let robotX, robotY;
    if (this.currentLevel.startingPos[0] - 263.5 < 0) {
      this.origin[0] = 0;
      robotX = this.currentLevel.startingPos[0];
    } else {
      this.origin[0] = this.currentLevel.startingPos[0] - 263.5;
      robotX = 263.5;
    }
    if (this.currentLevel.startingPos[1] - 187.5 < 0) {
      this.origin[1] = 0;
      robotY = this.currentLevel.startingPos[1];
    } else if ((this.currentLevel.foregroundGrid.length * BLOCK_LENGTH) - this.currentLevel.startingPos[1] < 187.5) {
      this.origin[1] = (this.currentLevel.foregroundGrid.length * BLOCK_LENGTH) - 450;
      robotY = this.currentLevel.startingPos[1] - this.origin[1];
    } else {
      this.origin[1] = this.currentLevel.startingPos[1] - 187.5;
      robotY = 187.5;
    }
    this.robot = new Robot([robotX, robotY]);
    this.status = "inControl";
    this.updatePower();
    if (this.mainLoopRunning === false) {
      this.mainLoopRunning = true;
      this.main(Date.now());
    }
  }

  advanceLevel() {
    this.levelSequence.shift();
    if (this.levelSequence.length === 0) {
      this.status = "end screen";
    } else {
      this.startLevel();
    }
  }

  main(passedThen) {
    if (this.spaceTime > 0) {
      this.spaceTime -= 1;
    }
    let now = Date.now();
    let delta = now - passedThen;
    this.update(delta / 1000);
    this.renderer.renderScreen();
    let newThen = now;
    window.requestAnimationFrame(() => {
      this.main(newThen);
    });
  }

  update(modifier) {
    let realArrays = [this.origin, this.robot.pos];
    let topRow = this.getTopRow(realArrays);
    let bottomRow = this.getBottomRow(realArrays);
    let leftCol = this.getLeftColumn(realArrays);
    let rightCol = this.getRightColumn(realArrays);
    let ghostArrays = [this.origin, this.robot.pos];
    let aboveTopObj = null;
    let topObj = null;
    let bottomObj = null;
    let edge;

    if (this.status === "rising" || this.status === "finished") {
      ghostArrays = this.moveUp(this.elevatorArray[0].speed, modifier);
      this.elevatorArray.forEach(function (elevator) {
        elevator.additionalPixels += (elevator.speed * modifier);
      });
    } else if (this.status === "descending") {
      ghostArrays = this.moveDown(this.elevatorArray[0].speed, modifier);
      this.elevatorArray.forEach(function (elevator) {
        elevator.additionalPixels -= (elevator.speed * modifier);
      });
    } else if (this.status === "inControl") {
      this.checkForSpring(topRow, bottomRow, leftCol, rightCol);
      if (38 in this.keysDown) { //up
        this.handleVerticalKeys(leftCol, rightCol, topRow, bottomRow, "up");
      } else if (40 in this.keysDown) { //down
        this.handleVerticalKeys(leftCol, rightCol, topRow, bottomRow, "down");
      }
      if (39 in this.keysDown) { //right
        ghostArrays = this.moveRight(this.robot.speed, modifier);
        let ghostCol = this.getRightColumn(ghostArrays);
        aboveTopObj = this.currentLevel.foregroundGrid[topRow - 1][ghostCol];
        topObj = this.currentLevel.foregroundGrid[topRow][ghostCol];
        bottomObj = this.currentLevel.foregroundGrid[bottomRow][ghostCol];
        let bottomRightObj = this.currentLevel.foregroundGrid[bottomRow][ghostCol + 1];
        if (this.passThrough(topObj, aboveTopObj, "right") === false || this.passThrough(bottomObj, topObj, "right") === false) {
          const robotX = this.getRealRightX(realArrays);
          edge = 0.5 + (ghostCol * this.BLOCK_LENGTH) - 1;
          const difference = edge - robotX;
          ghostArrays = this.moveRight(difference, 1);
        } else if (bottomRightObj.toString() === "ButtonBlock") {
          let buttonStuff = this.getLeftButtonEdge(ghostArrays);
          if (buttonStuff !== -1) {
            edge = buttonStuff[0];
            let button = buttonStuff[1];
            let robotX = this.getRealRightX(realArrays);
            let difference = edge - robotX;
            ghostArrays = this.moveRight(difference, 1);
            if (button.hasPower) { button.pushFunc(button); }
          }
        } else if (bottomObj.toString() === "door") {
          edge = this.getLeftDoorEdge(ghostArrays, bottomObj);
          if (edge !== -1) {
            const robotX = this.getRealRightX(realArrays);
            const difference = robotX - edge;
            if (difference > 0) {
              ghostArrays = this.moveLeft(difference, 1);
            }
          }
        }
      } else if (37 in this.keysDown) { //left
        ghostArrays = this.moveLeft(this.robot.speed, modifier);
        let ghostCol = this.getLeftColumn(ghostArrays);
        aboveTopObj = this.currentLevel.foregroundGrid[topRow - 1][ghostCol];
        topObj = this.currentLevel.foregroundGrid[topRow][ghostCol];
        bottomObj = this.currentLevel.foregroundGrid[bottomRow][ghostCol];
        let bottomLeftObj = this.currentLevel.foregroundGrid[bottomRow][ghostCol - 1];
        if (this.passThrough(topObj, aboveTopObj, "left") === false || this.passThrough(bottomObj, topObj, "left") === false) {
          let robotX = this.getRealLeftX(realArrays);
          edge = 0.5 + ((ghostCol + 1) * this.BLOCK_LENGTH);
          let difference = robotX - edge;
          ghostArrays = this.moveLeft(difference, 1);
        } else if (bottomLeftObj.toString() === "ButtonBlock") {
          const buttonStuff = this.getRightButtonEdge(ghostArrays);
          if (buttonStuff !== -1) {
            edge = buttonStuff[0];
            const button = buttonStuff[1];
            let robotX = this.getRealLeftX(realArrays);
            let difference = robotX - edge;
            ghostArrays = this.moveLeft(difference, 1);
            if (button.hasPower) { button.pushFunc(button); }
          }
        } else if (bottomObj.toString() === "door") {
          edge = this.getRightDoorEdge(ghostArrays, bottomObj);
          if (edge !== -1) {
            let robotX = this.getRealLeftX(realArrays);
            let difference = edge - robotX;
            if (difference > 0) {
              ghostArrays = this.moveRight(difference, 1);
            }
          }
        }
      } else if (32 in this.keysDown && this.spaceTime === 0) { //space
        this.spaceTime = 20;
        const robotLeft = this.getRealLeftX(realArrays);
        const leftColumn = this.getLeftColumn(realArrays);
        const leftEdge = (this.BLOCK_LENGTH * leftColumn) + 0.5;
        const distanceToLeftEdge = robotLeft - leftEdge;
        if (distanceToLeftEdge <= 15) {
          let cubby = this.cubbyAt([topRow, leftColumn]);
          if (cubby && this.heightCloseEnough()) {
            this.moveLeft(distanceToLeftEdge, 1);
            this.swapCubbyItem(cubby);
          }
        } else {
          const robotRight = this.getRealRightX(realArrays);
          const rightColumn = this.getRightColumn(realArrays);
          const rightEdge = this.BLOCK_LENGTH * (rightColumn + 1);
          const distanceToRightEdge = rightEdge - robotRight;
          if (distanceToRightEdge <= 15) {
            let cubby = this.cubbyAt([topRow, rightColumn]);
            if (cubby && this.heightCloseEnough()) {
              this.moveRight(distanceToRightEdge, 1);
              this.swapCubbyItem(cubby);
            }
          }
        }
      }
    }
    const ghostHeight = (this.status === "rising" ? this.checkSpringHeight(ghostArrays) : undefined);
    this.setGhostToReal(ghostArrays, ghostHeight);
    if (this.status === "rising" || this.status === "descending") {
      this.checkElevator();
    }
    if (this.status === "finished" && this.robot.pos[1] < -200) {
      this.advanceLevel();
    }
  }

  checkSpringHeight(ghostArrays) {
    const topRow = this.getTopRow(ghostArrays);
    const leftCol = this.getLeftColumn(ghostArrays);
    const rightCol = this.getRightColumn(ghostArrays);
    if (this.passThrough(this.currentLevel.foregroundGrid[topRow][leftCol]) === false ||
    this.passThrough(this.currentLevel.foregroundGrid[topRow][rightCol]) === false) {
      const realTopY = this.getRealTopY(ghostArrays);
      const diff = this.getBlockRealBottomY(topRow) - this.getRealTopY(ghostArrays);
      return this.robot.height - diff;
    }
  }

  cubbyAt(rowCol) {
    for (let i = 0; i < this.currentLevel.cubbies.length; i++) {
      if (this.currentLevel.cubbies[i].rowCol[0] === rowCol[0] && this.currentLevel.cubbies[i].rowCol[1] === rowCol[1]) {
        return this.currentLevel.cubbies[i];
      }
    }
  }

  heightCloseEnough() {
    return (this.robot.height % BLOCK_LENGTH) <= 20;
  }

  swapCubbyItem(cubby) {
    const itemFromCubby = cubby.item;
    cubby.item = this.robot.item;
    this.robot.item = itemFromCubby;
    if (this.robot.item) {
      this.robot.item.hasPower = false;
    }
    this.updatePower();
  }

  checkForSpring(topRow, bottomRow, leftCol, rightCol) {
    if (this.currentLevel.foregroundGrid[topRow][leftCol].toString() === "spring" && this.currentLevel.foregroundGrid[topRow][leftCol].pickedUp === false) {
      this.getSpring(this.currentLevel.foregroundGrid[topRow][leftCol]);
    }
    if (this.currentLevel.foregroundGrid[topRow][rightCol].toString() === "spring" && this.currentLevel.foregroundGrid[topRow][rightCol].pickedUp === false) {
      this.getSpring(this.currentLevel.foregroundGrid[topRow][rightCol]);
    }
    if (this.currentLevel.foregroundGrid[bottomRow][leftCol].toString() === "spring" && this.currentLevel.foregroundGrid[bottomRow][leftCol].pickedUp === false) {
      this.getSpring(this.currentLevel.foregroundGrid[bottomRow][leftCol]);
    }
    if (this.currentLevel.foregroundGrid[bottomRow][rightCol].toString() === "spring" && this.currentLevel.foregroundGrid[bottomRow][rightCol].pickedUp === false) {
      this.getSpring(this.currentLevel.foregroundGrid[bottomRow][rightCol]);
    }
  }

  getSpring(spring) {
    spring.pickedUp = true;
    this.robot.maxHeight += 75;
  }

  updatePower() {
    this.clearPower();
    for (let i = 0; i < this.currentLevel.powerSources.length; i++) {
      this.currentLevel.powerSources[i].sendPower(this.currentLevel.wiring, this.currentLevel.cubbies, this.currentLevel.buttonBlocks, this.currentLevel.forceFieldBlocks);
    }
  }

  clearPower() {
    for (let i = 0; i < this.currentLevel.wiring.length; i++) {
      if (this.currentLevel.wiring[i] instanceof Wire) {
        this.currentLevel.wiring[i].hasPower = false;
      } else {
        Object.keys(this.currentLevel.wiring[i].segments).forEach(function (key) {
          this.currentLevel.wiring[i].segments[key].hasPower = false;
        }.bind(this));
      }
    }
    for (let i = 0; i < this.currentLevel.forceFieldBlocks.length; i++) {
      this.currentLevel.forceFieldBlocks[i].hasPower = false;
    }
    for (let i = 0; i < this.currentLevel.buttonBlocks.length; i++) {
      this.currentLevel.buttonBlocks[i].hasPower = false;
    }
  }

  getLeftButtonEdge(arrays) {
    const nextColumnToRight = this.getRightColumn(arrays) + 1;
    if (
      this.currentLevel.foregroundGrid[
        this.getTopRow(arrays)][nextColumnToRight].toString() === "ButtonBlock" &&
        this.currentLevel.foregroundGrid[this.getTopRow(arrays)][nextColumnToRight].side === "left") {
      const button = this.currentLevel.foregroundGrid[this.getTopRow(arrays)][nextColumnToRight];
      const robotRightX = this.getRealRightX(arrays);
      const blockRealRightX = this.getBlockRealRightX(this.getRightColumn(arrays));
      const buttonEdge = blockRealRightX - this.renderer.BUTTON_PANEL_WIDTH - 1;
      if (robotRightX > buttonEdge) {
        return [buttonEdge, button];
      } else {
        return -1;
      }
    } else {
      return -1;
    }
  }

  getRightButtonEdge(arrays) {
    const nextColumnToLeft = this.getLeftColumn(arrays) - 1;
    if (
      this.currentLevel.foregroundGrid[
        this.getTopRow(arrays)][nextColumnToLeft].toString() === "ButtonBlock" &&
        this.currentLevel.foregroundGrid[this.getTopRow(arrays)][nextColumnToLeft].side === "right"
    ) {
      const button = this.currentLevel.foregroundGrid[this.getTopRow(arrays)][nextColumnToLeft];
      const robotLeftX = this.getRealLeftX(arrays);
      const blockRealLeftX = this.getBlockRealLeftX(this.getLeftColumn(arrays));
      const buttonEdge = blockRealLeftX + this.renderer.BUTTON_PANEL_WIDTH;
      if (robotLeftX < buttonEdge) {
        return [buttonEdge, button];
      } else {
        return -1;
      }
    } else {
      return -1;
    }
  }

  getRightDoorEdge(arrays, door) {
    if (door.status !== "open" && door.side === "left") {
      const blockRealLeftX = this.getBlockRealLeftX(this.getLeftColumn(arrays));
      const doorEdge = blockRealLeftX + (this.BLOCK_LENGTH / 3);
      return doorEdge;
    } else {
      return -1;
    }
  }

  getLeftDoorEdge(arrays, door) {
    if (door.status !== "open" && door.side === "right") {
      const blockRealRightX = this.getBlockRealRightX(this.getRightColumn(arrays));
      const doorEdge = blockRealRightX - (this.BLOCK_LENGTH / 3) - 1;
      return doorEdge;
    } else {
      return -1;
    }
  }

  passThrough(object, aboveObject, dir) {
    dir = dir || "";
    if (object === "block" || object === "platform" ||
    object.toString() === "door" && object.status === "closed" && object.side !== dir ||
    object.toString() === "ButtonBlock" ||
    object.toString() === "ForceFieldBlock" ||
    object.toString() === "PowerSource" ||
    object === "forceField" && aboveObject.hasPower) {
      return false;
    } else {
      return true;
    }
  }

  handleVerticalKeys(leftCol, rightCol, topRow, bottomRow, key) {
    const elevators = this.currentLevel.elevators;
    const belowRow = bottomRow + 1;
    let foundElevator = false;
    if (leftCol === rightCol) {
      let elevatorsToLaunch = [];
      for (let el = 0; el < elevators.length; el++) {
        if (elevators[el].col === leftCol && (elevators[el].baseRow - elevators[el].blocksHigh === bottomRow + 1)) {
          foundElevator = true;
          elevatorsToLaunch.push(elevators[el]);
          for (let j = 0; j < elevators.length; j++) {
            if (j !== el && elevators[j].id === elevators[el].id) {
              elevatorsToLaunch.push(elevators[j]);
            }
          }
          let elevatorResult = this.launchElevatorMaybe(elevatorsToLaunch, key);
          if (elevatorResult === false) {
            this.adjustRobotHeight(leftCol, rightCol, topRow, bottomRow, key);
          }
          break;
        }
      }
      if (foundElevator === false) {
        this.adjustRobotHeight(leftCol, rightCol, topRow, bottomRow, key);
      }
    } else {
      for (let el = 0; el < elevators.length; el++) {
        if (elevators[el].col === leftCol && (elevators[el].baseRow - elevators[el].blocksHigh === bottomRow + 1)) {
          foundElevator = true;
          let foundSecondElevator = false;
          for (let el2 = 0; el2 < elevators.length; el2++) {
            if (elevators[el2] !== elevators[el] && elevators[el2].id === elevators[el].id && elevators[el2].col === rightCol) {
              foundSecondElevator = true;
              let elevatorResult = this.launchElevatorMaybe([elevators[el], elevators[el2]], key);
              if (elevatorResult) {
                return;
              } else { //elevator didn't move (top or bottom floor)
                foundSecondElevator = false;
              }
            }
          }
          if (foundSecondElevator === false) {
            this.adjustRobotHeight(leftCol, rightCol, topRow, bottomRow, key);
          }
        }
      }
      if (foundElevator === false) {
        this.adjustRobotHeight(leftCol, rightCol, topRow, bottomRow, key);
      }
    }
  }

  adjustRobotHeight(leftCol, rightCol, topRow, bottomRow, key) {
    const SPRING_SPEED = 6;
    let adjustedHeightIncrement = SPRING_SPEED;
    const leftUpperBlock = this.currentLevel.foregroundGrid[topRow - 1][leftCol];
    const rightUpperBlock = this.currentLevel.foregroundGrid[topRow - 1][rightCol];
    if (key === 'up') {
      if (this.robot.height < this.robot.maxHeight) {
        //reach end of spring?
        const ghostHeight = this.robot.height + SPRING_SPEED;
        if (ghostHeight > this.robot.maxHeight) {
          adjustedHeightIncrement -= (ghostHeight - this.robot.maxHeight);
        }
        //hit next row?
        let distNextRow;
        if (this.robot.height <= 10) {
          distNextRow = 10 - this.robot.height;
        } else {
          distNextRow = 85 - this.robot.height;
        }
        const ghostDistNextRow = distNextRow - adjustedHeightIncrement;
        if (ghostDistNextRow >= 0 || (this.passThrough(leftUpperBlock) && this.passThrough(rightUpperBlock))) {
          this.robot.height += adjustedHeightIncrement;
        } else {
          this.robot.height += distNextRow;
        }
      }
    } else if (key === 'down') {
      if (this.robot.height > 0) {
        this.robot.height -= SPRING_SPEED;
        if (this.robot.height < 0) {
          this.robot.height = 0;
        }
      }
    }
  }

  launchElevatorMaybe(elevatorArray, dir) {
    this.elevatorArray = elevatorArray;
    const blockHeightIndex = elevatorArray[0].heights.indexOf(elevatorArray[0].blocksHigh);
    let destinationRow, stopAt;
    if (dir === "up") {
      if (elevatorArray[0].exit === true) {
        this.status = "finished";
      } else {
        if (this.endOfElevator(elevatorArray, dir, blockHeightIndex) === false) {
          this.newElevatorHeight = elevatorArray[0].heights[blockHeightIndex + 1];
          destinationRow = elevatorArray[0].baseRow - elevatorArray[0].heights[blockHeightIndex + 1];
          stopAt = 0 + (BLOCK_LENGTH * destinationRow) - 0.5;
          this.status = "rising";
          this.stopAt = stopAt;
          return true;
        } else {
          return false;
        }
      }
    } else if (dir === "down") {
      if (this.endOfElevator(elevatorArray, dir, blockHeightIndex) === false) {
        this.newElevatorHeight = elevatorArray[0].heights[blockHeightIndex - 1];
        destinationRow = elevatorArray[0].baseRow - elevatorArray[0].heights[blockHeightIndex - 1];
        stopAt = 0 + (BLOCK_LENGTH * destinationRow) - 0.5;
        this.status = "descending";
        this.stopAt = stopAt;
        return true;
      } else {
        return false;
      }
    }
  }

  endOfElevator(elevatorArray, dir, blockHeightIndex) {
    if (dir === "up") {
      return (blockHeightIndex + 1) === elevatorArray[0].heights.length;
    } else if (dir === "down") {
      return blockHeightIndex === 0;
    }
  }

  checkElevator() {
    if (this.status === "rising") {
      let realRobotBottom = this.getRealBottomY([this.origin, this.robot.pos]);
      if (realRobotBottom === this.stopAt) {
        this._afterElevatorInNewSpot();
      } else if (realRobotBottom < this.stopAt) {
        let difference = this.stopAt - realRobotBottom;
        this.moveDown(difference, 1);
        this.elevatorArray.forEach(function (elevator) {
          elevator.additionalPixels -= (difference);
        });
        this._afterElevatorInNewSpot();
      }
    } else if (this.status === "descending") {
      let realRobotBottom = this.getRealBottomY([this.origin, this.robot.pos]);
      if (realRobotBottom === this.stopAt) {
        this._afterElevatorInNewSpot();
      } else if (realRobotBottom > this.stopAt) {
        let difference = realRobotBottom - this.stopAt;
        this.moveUp(difference, 1);
        this.elevatorArray.forEach(function (elevator) {
          elevator.additionalPixels += (difference);
        });
        this._afterElevatorInNewSpot();
      }
    }
  }

  _afterElevatorInNewSpot() {
    this.status = "inControl";
    const newElevatorHeight = this.newElevatorHeight;
    this.elevatorArray.forEach(function (elevator) {
      elevator.blocksHigh = newElevatorHeight;
      elevator.topRow = elevator.baseRow - elevator.blocksHigh;
      elevator.additionalPixels = 0;
    });
  }

  moveLeft(pixels, modifier) {
    let returnOrigin = this.origin;
    let returnPos = this.robot.pos;
    if (this.origin[0] < 0) {
      returnOrigin[0] = 0;
    } else if (this.robot.pos[0] === 263.5 && this.origin[0] > 0) {
      returnOrigin[0] -= pixels * modifier;
    } else if (this.robot.pos[0] < 263.5 && this.origin[0] > 0) {
      returnPos[0] = 263.5;
      returnOrigin[0] -= pixels * modifier;
    } else {
      returnPos[0] -= pixels * modifier;
    }
    return [returnOrigin, returnPos];
  }

  moveRight(pixels, modifier) {
    let returnOrigin = this.origin;
    let returnPos = this.robot.pos;
    if (this.levelWidth - this.origin[0] < this.BLOCK_LENGTH * 8) {
      returnOrigin[0] = this.levelWidth - (this.BLOCK_LENGTH * 8);
    } else if (this.robot.pos[0] === 263.5 && (this.levelWidth - this.origin[0]) > (this.BLOCK_LENGTH * 8)) {
      returnOrigin[0] += pixels * modifier;
    } else if (this.robot.pos[0] > 263.5 && (this.levelWidth - this.origin[0]) > (this.BLOCK_LENGTH * 8)) {
      returnPos[0] = 263.5;
      returnOrigin[0] += pixels * modifier;
    } else {
      returnPos[0] += pixels * modifier;
    }
    return [returnOrigin, returnPos];
  }

  moveUp(pixels, modifier) {
    let returnOrigin = this.origin;
    let returnPos = this.robot.pos;
    if (this.robot.pos[1] === 187.5 && this.origin[1] > 0) {
      returnOrigin[1] -= pixels * modifier;
    } else if (this.robot.pos[1] < 187.5 && this.origin[1] > 0) {
      let difference = 187.5 - this.robot.pos[1];
      returnOrigin[1] -= pixels * modifier;
      returnPos[1] = 187.5;
      returnOrigin[1] -= difference;
    } else {
      returnPos[1] -= pixels * modifier;
    }
    if (returnOrigin[1] < 0) { //has the view passed the top of the level?
      let difference = 0 - returnOrigin[1]; //by how much?
      returnOrigin[1] = 0; //set the view back to 0
      returnPos[1] -= difference; //push the robot down by the same amount
    }
    return [returnOrigin, returnPos];
  }

  moveDown(pixels, modifier) {
    let returnOrigin = this.origin;
    let returnPos = this.robot.pos;
    let difference;
    if (this.robot.pos[1] === 187.5 && (this.levelHeight - this.origin[1]) > (this.BLOCK_LENGTH * 6)) {
      returnOrigin[1] += pixels * modifier;
    } else if (this.robot.pos[1] > 187.5 && (this.levelHeight - this.origin[1]) > (this.BLOCK_LENGTH * 6)) {
      difference = this.robot.pos[1] - 187.5;
      returnOrigin[1] += pixels * modifier;
      returnPos[1] = 187.5;
      returnOrigin[1] += difference;
    } else {
      returnPos[1] += pixels * modifier;
    }
    const topOfScreenToLevelBottom = this.levelHeight - returnOrigin[1];
    if (topOfScreenToLevelBottom < this.BLOCK_LENGTH * 6) {
      difference = (this.BLOCK_LENGTH * 6) - topOfScreenToLevelBottom;
      returnOrigin[1] = this.levelHeight - (this.BLOCK_LENGTH * 6);
      returnPos[1] += difference;
    }
    return [returnOrigin, returnPos];
  }

  setGhostToReal(ghostArrays, ghostHeight) {
    this.origin = ghostArrays[0];
    this.robot.pos = ghostArrays[1];
    if (ghostHeight) {
      this.robot.height = ghostHeight;
    }
  }

  getLeftColumn(arrays) {
    const xInLevel = this.getRealLeftX(arrays);
    const column = Math.floor(xInLevel / this.BLOCK_LENGTH);
    return column;
  }

  getRightColumn(arrays) {
    const xInLevel = this.getRealRightX(arrays);
    const column = Math.floor(xInLevel / this.BLOCK_LENGTH);
    return column;
  }

  getTopRow(arrays) {
    const yInLevel = this.getRealTopY(arrays);
    const row = Math.floor(yInLevel / this.BLOCK_LENGTH);
    return row;
  }

  getBottomRow(arrays) {
    const yInLevel = this.getRealBottomY(arrays);
    const row = Math.floor(yInLevel / this.BLOCK_LENGTH);
    return row;
  }

  getRealLeftX(arrays) {
    return arrays[0][0] + arrays[1][0];
  }

  getRealRightX(arrays) {
    return arrays[0][0] + (arrays[1][0] + this.BLOCK_LENGTH - 1);
  }

  getRealTopY(arrays) {
    return arrays[0][1] + arrays[1][1] - this.robot.height + 10;
  }

  getRealBottomY(arrays) {
    return arrays[0][1] + (arrays[1][1] + this.BLOCK_LENGTH - 1);
  }

  getBlockRealRightX(column) {
    return (0.5 + (column + 1) * this.BLOCK_LENGTH);
  }

  getBlockRealLeftX(column) {
    return (0.5 + (column) * this.BLOCK_LENGTH);
  }

  getBlockRealBottomY(row) {
    return (0.5 + (row + 1) * this.BLOCK_LENGTH);
  }

}

module.exports = Game;
