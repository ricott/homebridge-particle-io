const request = require('request');
const EventSource = require('eventsource');
const Accessory = require('./Accessory.js');

class GarageDoorAccessory extends Accessory {

  constructor(log, url, accessToken, device, homebridge) {
    const Service = homebridge.hap.Service;
    const Characteristic = homebridge.hap.Characteristic;
    super(log, url, accessToken, device, homebridge, Service.GarageDoorOpener, Characteristic.CurrentDoorState);

    this.function_name = !device.function_name ? 'power' : device.function_name;
    this.eventName = device.event_name;

    this._targetDoorState = Characteristic.TargetDoorState.CLOSED;
    this._currentDoorState = Characteristic.CurrentDoorState.CLOSED;

    const garageService = new Service.GarageDoorOpener(this.name);
    garageService
              .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED)
              .getCharacteristic(Characteristic.TargetDoorState)
              .on('set', this.setTargetDoorState.bind(this));

    this.eventUrl = `${this.url}${this.deviceId}/events/${this.eventName}?access_token=${this.accessToken}`;
    this.log('Listening for events from:', this.eventUrl);

    const events = new EventSource(this.eventUrl);
    events.addEventListener(this.eventName, this.processEventData.bind(this));
    events.onerror = this.processEventError.bind(this);
    garageService
              .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED)
              .getCharacteristic(Characteristic.CurrentDoorState)
              .on('get', this.getCurrentDoorState.bind(this));

    this.services.push(garageService);
  }

  processEventError(error) {
    this.log('ERROR!', error);
  }

  processEventData(e) {
    const Characteristic = homebridge.hap.Characteristic;
    const data = JSON.parse(e.data);
    const result = data.data;

    this.log("Value for door-state event: ", result);

    if (result == "open") {
      this._currentDoorState = Characteristic.CurrentDoorState.OPEN;
    } else if (result == "closed") {
      this._currentDoorState = Characteristic.CurrentDoorState.CLOSED;
    } else if (result == "opening") {
      this._currentDoorState = Characteristic.CurrentDoorState.OPENING;
    } else if (result == "closing") {
      this._currentDoorState = Characteristic.CurrentDoorState.CLOSING;
    } else if (result == "stopped-opening" || value == "stopped-closing" || value == "unknown") {
      this._currentDoorState = Characteristic.CurrentDoorState.STOPPED;
    }

    const service = this.services[1];
    service.setCharacteristic(Characteristic.CurrentDoorState, this._currentDoorState);
  }

  getCurrentDoorState(callback) {
    callback(null, this._currentDoorState);
  }

  setTargetDoorState(value, callback) {
    this.log("setTargetDoorState: ", value);
    this._targetDoorState = value;
    this.callParticleFunction(this.function_name, value, (error, response, body) => this.callbackHelper(error, response, body, callback), true);
  }

  callParticleFunction(functionName, arg, callback, outputRAW) {
    const url = `${this.url}${this.deviceId}/${functionName}`;
    this.log('Calling function: "', url, '" with arg: ', arg);
    const form = {
      access_token: this.accessToken,
      arg
    };
    if (outputRAW) {
      form.format = 'raw';
    }
    request.post(
      url,
      {
        form
      },
      callback
    );
  }

  callbackHelper(error, response, body, callback) {
    if (!error) {
      callback();
    } else {
      this.log(error);
      this.log(response);
      this.log(body);
      callback(error);
    }
  }
}

module.exports = GarageDoorAccessory;
