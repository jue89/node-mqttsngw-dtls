# MQTT-SN Gateway: DTLS

This module is part of [mqttsngw](https://github.com/jue89/node-mqttsngw). It is responsible for handling incoming DTLS connections from the sensor network and parsing and generating MQTT-SN packets.

All packet conversions are handled by [mqttsn-packet](https://github.com/ithinuel/mqttsn-packet).

## Factory

```js
const DTLS = require('mqttsngw-dtls');
mqttsngw.attach(DTLS(opts));
```

Creates a new DTLS factory and attaches it to an existing instance of *mqttsngw*. ```opts``` has the following fields:
 * ```log```: Optional. An object containing logging callbacks for all log levels (```error```, ```warn```, ```info```, ```debug```). Every callback is called with a human-readable message as the first argument followed by an object containing more information regarding the event: ```{ error: (msg, info) => { ... }, ...}```.
 * ```guard```: Optional. Callback function that is called for every parsed ingress packet: ```(peer, certInfo, packet) => { ... }```. Returns ```true``` if the packet shall pass and ```false``` if it shall not pass. Arguments for decision-making:
   * ```peer```: Object containing ```address``` and ```port``` of the sensor.
   * ```certInfo```: Objection containing further details of the client certificate if presented.
   * ```packet```: Packet parsed by [mqttsn-packet](https://github.com/ithinuel/mqttsn-packet).
 * ```bind```: ```options``` of the [Node.js Dgram bind method](https://nodejs.org/api/dgram.html#dgram_socket_bind_options_callback)
 * *All other options accepted by the createServer method of [openssl-dtls](https://github.com/jue89/node-openssl-dtls)*


## Events

All in all just two events are consumed and emitted by the *DTLS* module on the event bus.

### Consumed

| Event                          | Description |
| ------------------------------ | ----------- |
| snUnicastOutgress,\*,\*          | A packet shall be sent to a sensor |


### Emitted

| Event                          | Description |
| ------------------------------ | ----------- |
| snUnicastIngress,\*,\*           | A packet has been received from a sensor |
