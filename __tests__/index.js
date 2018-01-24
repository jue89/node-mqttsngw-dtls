jest.mock('openssl-dtls');
const DTLS = require('openssl-dtls');

const dtls = require('../index.js');

test('reject if creating DTLS socket failed', () => {
	const ERR = new Error();
	DTLS.createServer.mockImplementationOnce(() => { throw ERR; });
	return dtls({})({})
		.then(() => Promise.reject(new Error('FAILED')))
		.catch((e) => {
			expect(e).toBe(ERR);
		});
});

test('call bind method on start call', () => {
	const bind = {};
	return dtls({ bind })({}).then((start) => start()).then(() => {
		expect(DTLS._createServer.bind.mock.calls[0][0]).toBe(bind);
	});
});

test('debug log incoming handshakes', () => {
	const PEER = {
		address: '::1',
		port: 12345
	};
	const debug = jest.fn();
	dtls({ log: { debug } })({});
	DTLS._createServer.emit('connection', PEER);
	expect(debug.mock.calls[0][0]).toEqual('Handshake started by [::1]:12345');
	expect(debug.mock.calls[0][1]).toMatchObject({
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
	dtls({ log: { warn } })({});
	DTLS._createServer.emit('error', ERR, PEER);
	expect(warn.mock.calls[0][0]).toEqual('Error caused by [::1]:12345: testErr');
	expect(warn.mock.calls[0][1]).toMatchObject({
		message_id: 'c62a326b9eae447c862d139a5972f92c',
		clientKey: `${PEER.address}_${PEER.port}`
	});
});

test('debug log established connections', () => {
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const debug = jest.fn();
	dtls({ log: { debug } })({});
	DTLS._createServer.emit('secureConnection', SOCKET);
	expect(debug.mock.calls[0][0]).toEqual('Handshake successfully finished with [::1]:12345');
	expect(debug.mock.calls[0][1]).toMatchObject({
		message_id: '1d223f68a881407d86b94babf40da157',
		clientKey: '::1_12345'
	});
});

test('debug log closed connections', () => {
	const SOCKET = DTLS._socket({
		address: '::1',
		port: 12345
	});
	const debug = jest.fn();
	dtls({ log: { debug } })({});
	DTLS._createServer.emit('secureConnection', SOCKET);
	SOCKET.emit('close');
	expect(debug.mock.calls[1][0]).toEqual('Connection to [::1]:12345 closed');
	expect(debug.mock.calls[1][1]).toMatchObject({
		message_id: '0664446f18574088b369460de3aa197b',
		clientKey: '::1_12345'
	});
});
