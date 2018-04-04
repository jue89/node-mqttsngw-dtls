jest.mock('x509');
const x509 = require('x509');

jest.mock('openssl-dtls');
const DTLS = require('openssl-dtls');

jest.mock('mqttsn-packet');
const mqttsn = require('mqttsn-packet');

const dtls = require('../index.js');

const bus = {
	on: jest.fn(),
	emit: jest.fn(() => true),
	removeListener: jest.fn()
};

test('reject if creating DTLS socket failed', (done) => {
	const ERR = new Error();
	DTLS.createServer.mockImplementationOnce(() => { throw ERR; });
	try {
		dtls({})(bus);
		done(new Error('FAILED'));
	} catch (e) {
		expect(e).toBe(ERR);
		done();
	}
});

test('call bind method on start call', () => {
	const bind = {};
	dtls({ bind })({})();
	expect(DTLS._createServer.bind.mock.calls[0][0]).toBe(bind);
});

test('call close method on stop call', (done) => {
	const bind = {};
	dtls({ bind })({})()().then(done);
	expect(DTLS._createServer.close.mock.calls.length).toEqual(1);
	DTLS._createServer.close.mock.calls[0][0]();
});

test('info log incoming handshakes', () => {
	const PEER = {
		address: '::1',
		port: 12345
	};
	const info = jest.fn();
	dtls({ log: { info } })(bus);
	DTLS._createServer.emit('connection', PEER);
	expect(info.mock.calls[0][0]).toEqual('Handshake started by [::1]:12345');
	expect(info.mock.calls[0][1]).toMatchObject({
		message_id: 'c266859e94db40edbf126f74634dd5fc',
		clientKey: `${PEER.address}_${PEER.port}`
	});
});

test('warn log errors caused by peers', () => {
	const PEER = {
		address: '::1',
		port: 12345
	};
	const ERR = new Error('testErr');
	const warn = jest.fn();
	dtls({ log: { warn } })(bus);
	DTLS._createServer.emit('error', ERR, PEER);
	expect(warn.mock.calls[0][0]).toEqual('Error caused by [::1]:12345: testErr');
	expect(warn.mock.calls[0][1]).toMatchObject({
		message_id: 'c62a326b9eae447c862d139a5972f92c',
		clientKey: `${PEER.address}_${PEER.port}`
	});
});

test('info log established connections', () => {
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const info = jest.fn();
	dtls({ log: { info } })(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	expect(info.mock.calls[0][0]).toEqual('Handshake successfully finished with [::1]:12345');
	expect(info.mock.calls[0][1]).toMatchObject({
		message_id: '1d223f68a881407d86b94babf40da157',
		clientKey: '::1_12345'
	});
});

test('info log closed connections', () => {
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const info = jest.fn();
	dtls({ log: { info } })(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	SOCKET.emit('close');
	expect(info.mock.calls[1][0]).toEqual('Connection to [::1]:12345 closed');
	expect(info.mock.calls[1][1]).toMatchObject({
		message_id: '0664446f18574088b369460de3aa197b',
		clientKey: '::1_12345'
	});
});

test('parse incoming messages', () => {
	const BUFFER = Buffer.alloc(0);
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	dtls({})(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	SOCKET.emit('message', BUFFER);
	expect(mqttsn._parser.parse.mock.calls[0][0]).toBe(BUFFER);
});

test('check incoming packets with guard function and block', () => {
	const BUFFER = Buffer.alloc(0);
	const ADDRESS = {
		address: '::1',
		port: 12345
	};
	const CERT = Buffer.from('test');
	const SOCKET = DTLS._socket(ADDRESS, CERT);
	const guard = jest.fn(() => false);
	const warn = jest.fn();
	dtls({ guard, log: { warn } })(bus);
	const CERTINFO = {};
	x509.parseCert.mockReturnValueOnce(CERTINFO);
	DTLS._createServer.emit('secureConnection', SOCKET);
	SOCKET.emit('message', BUFFER);
	expect(mqttsn._parser.parse.mock.calls[0][0]).toBe(BUFFER);
	const PACKET = { cmd: 'test' };
	mqttsn._parser.emit('packet', PACKET);
	expect(x509.parseCert.mock.calls[0][0]).toEqual(CERT.toString());
	expect(guard.mock.calls[0][0]).toMatchObject(ADDRESS);
	expect(guard.mock.calls[0][1]).toBe(CERTINFO);
	expect(guard.mock.calls[0][2]).toBe(PACKET);
	expect(bus.emit.mock.calls.length).toEqual(0);
	expect(warn.mock.calls[0][0]).toEqual('Packet rejected by guard');
	expect(warn.mock.calls[0][1]).toMatchObject(Object.assign({
		message_id: 'ac6bd64f22b1401da2e4f10dc8310e8e',
		clientKey: '::1_12345'
	}, PACKET));
});

test('warn log parser errors', () => {
	const ERROR = new Error('testErr');
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const warn = jest.fn();
	dtls({ log: { warn } })(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	mqttsn._parser.emit('error', ERROR);
	expect(warn.mock.calls[0][0]).toEqual('Parser error: testErr');
	expect(warn.mock.calls[0][1]).toMatchObject({
		message_id: 'fed465ee771a4701ad119f1fda70972a',
		clientKey: '::1_12345'
	});
});

test('emit parsed packets to bus', () => {
	const PACKET = {
		cmd: 'testCmd'
	};
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	dtls({})(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	mqttsn._parser.emit('packet', PACKET);
	expect(bus.emit.mock.calls[0][0]).toMatchObject([
		'snUnicastIngress',
		'::1_12345',
		'testCmd'
	]);
	expect(bus.emit.mock.calls[0][1]).toMatchObject(Object.assign({
		clientKey: '::1_12345'
	}, PACKET));
});

test('error log if emitted bus events are not consumed', () => {
	const PACKET = {
		cmd: 'testCmd'
	};
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const error = jest.fn();
	dtls({ log: { error } })(bus);
	bus.emit.mockReturnValueOnce(false);
	DTLS._createServer.emit('secureConnection', SOCKET);
	mqttsn._parser.emit('packet', PACKET);
	expect(error.mock.calls[0][0]).toEqual('Unconsumed MQTTSN packet');
	expect(error.mock.calls[0][1]).toMatchObject({
		message_id: '9cf60d7aa0eb4b3f976f25671eea1ff5',
		clientKey: '::1_12345',
		cmd: 'testCmd'
	});
});

test('listen for outgress packets on the bus', () => {
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	dtls({})(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	expect(bus.on.mock.calls[0][0]).toMatchObject([
		'snUnicastOutgress',
		'::1_12345',
		'*'
	]);
});

test('convert outgress packets to buffer and transmit them', () => {
	const PACKET = {};
	const BUFFER = {};
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	dtls({})(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	mqttsn.generate.mockReturnValueOnce(BUFFER);
	bus.on.mock.calls[0][1](PACKET);
	expect(mqttsn.generate.mock.calls[0][0]).toBe(PACKET);
	expect(SOCKET.send.mock.calls[0][0]).toBe(BUFFER);
});

test('error log non-convertable outgress packets', () => {
	const PACKET = {
		test: 1234
	};
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const error = jest.fn();
	dtls({ log: { error } })(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	mqttsn.generate.mockImplementationOnce(() => {
		throw new Error('testErr');
	});
	bus.on.mock.calls[0][1](PACKET);
	expect(error.mock.calls[0][0]).toEqual('Generator error: testErr');
	expect(error.mock.calls[0][1]).toMatchObject(Object.assign({
		message_id: 'c05700ab021d47ddbd3ab914e2eef334',
		clientKey: '::1_12345'
	}, PACKET));
});

test('remove listener for outgress packets on the bus on disconnect', () => {
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	dtls({})(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	SOCKET.emit('close');
	expect(bus.removeListener.mock.calls[0][0]).toMatchObject([
		'snUnicastOutgress',
		'::1_12345',
		'*'
	]);
});

test('debug log raw ingress packets', () => {
	const PACKET = Buffer.from([0x1, 0x2, 0x3]);
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const debug = jest.fn();
	dtls({ log: { debug } })(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	SOCKET.emit('message', PACKET);
	expect(debug.mock.calls[0][0]).toEqual('Ingress packet: 010203');
	expect(debug.mock.calls[0][1]).toMatchObject({
		message_id: 'fd5b9fe5a8d24877ba8a4f751c8b4f5f',
		clientKey: '::1_12345'
	});
});

test('debug log raw outgress packets', () => {
	const BUFFER = Buffer.from([0x4, 0x5, 0x6]);
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const debug = jest.fn();
	dtls({ log: { debug } })(bus);
	DTLS._createServer.emit('secureConnection', SOCKET);
	mqttsn.generate.mockReturnValueOnce(BUFFER);
	bus.on.mock.calls[0][1]({});
	expect(debug.mock.calls[0][0]).toEqual('Outgress packet: 040506');
	expect(debug.mock.calls[0][1]).toMatchObject({
		message_id: 'dbd3fac559fe42ad90d9dcb7d4a816b3',
		clientKey: '::1_12345'
	});
});
