const DTLS = require('openssl-dtls');
const x509 = require('x509');
const mqttsn = require('mqttsn-packet');

module.exports = (opts) => (bus) => {
	// Create new DTLS server context
	const srv = DTLS.createServer(opts);

	// Debug log incoming handshakes
	if (opts.log && opts.log.info) {
		srv.on('connection', (peer) => opts.log.info(
			`Handshake started by [${peer.address}]:${peer.port}`,
			{
				message_id: 'c266859e94db40edbf126f74634dd5fc',
				clientKey: `${peer.address}_${peer.port}`
			}
		));
	}

	// Warn log DTLS errors caused by clients
	if (opts.log && opts.log.warn) {
		srv.on('error', (err, peer) => opts.log.warn(
			`Error caused by [${peer.address}]:${peer.port}: ${err.message}`,
			{
				message_id: 'c62a326b9eae447c862d139a5972f92c',
				clientKey: `${peer.address}_${peer.port}`
			}
		));
	}

	// React to incoming connections
	srv.on('secureConnection', (socket) => {
		const peer = socket.address();
		const clientKey = `${peer.address}_${peer.port}`;

		// If a guard method has been defined also fetch cert info
		const certInfo = (opts.guard)
			? x509.parseCert(socket.getCertChain().toString())
			: {};

		// Parse incoming packets
		const parser = mqttsn.parser();
		socket.on('message', (msg) => parser.parse(msg));
		parser.on('packet', (packet) => {
			// Call guard if it has been defined
			let ok = false;
			try {
				ok = opts.guard === undefined || opts.guard(peer, certInfo, packet);
			} catch (e) {}
			if (!ok) {
				if (opts.log && opts.log.warn) {
					opts.log.warn(`Packet rejected by guard`, Object.assign({
						message_id: 'ac6bd64f22b1401da2e4f10dc8310e8e',
						clientKey: clientKey
					}, packet));
				}
				return;
			}

			packet.clientKey = clientKey;
			const consumed = bus.emit(['snUnicastIngress', clientKey, packet.cmd], packet);
			if (!consumed && opts.log && opts.log.error) {
				opts.log.error('Unconsumed MQTTSN packet', Object.assign({
					message_id: '9cf60d7aa0eb4b3f976f25671eea1ff5',
					clientKey: clientKey
				}, packet));
			}
		});

		// Listen for outgress packets on the bus
		const outgressHandler = (packet) => {
			try {
				packet = mqttsn.generate(packet);
				socket.send(packet);
				if (opts.log && opts.log.debug) {
					opts.log.debug(`Outgress packet: ${packet.toString('hex')}`, {
						message_id: 'dbd3fac559fe42ad90d9dcb7d4a816b3',
						clientKey: clientKey
					});
				}
			} catch (err) {
				if (opts.log && opts.log.error) {
					opts.log.error(`Generator error: ${err.message}`, Object.assign({
						message_id: 'c05700ab021d47ddbd3ab914e2eef334',
						stack: err.stack,
						clientKey: clientKey
					}, packet));
				}
			}
		};
		const outgressEvent = ['snUnicastOutgress', clientKey, '*'];
		bus.on(outgressEvent, outgressHandler);
		socket.on('close', () => bus.removeListener(outgressEvent, outgressHandler));

		// Install logging handlers
		if (!opts.log) return;
		if (opts.log.debug) {
			socket.prependListener('message', (message) => opts.log.debug(
				`Ingress packet: ${message.toString('hex')}`,
				{
					message_id: 'fd5b9fe5a8d24877ba8a4f751c8b4f5f',
					clientKey: clientKey
				}
			));
		}
		if (opts.log.info) {
			opts.log.info(`Handshake successfully finished with [${peer.address}]:${peer.port}`, {
				message_id: '1d223f68a881407d86b94babf40da157',
				clientKey: clientKey
			});
			socket.on('close', () => opts.log.info(
				`Connection to [${peer.address}]:${peer.port} closed`,
				{
					message_id: '0664446f18574088b369460de3aa197b',
					clientKey: clientKey
				}
			));
		}
		if (opts.log.warn) {
			parser.on('error', (err) => opts.log.warn(
				`Parser error: ${err.message}`,
				{
					message_id: 'fed465ee771a4701ad119f1fda70972a',
					stack: err.stack,
					clientKey: clientKey
				}
			));
		} else {
			// Dummy listener: We don't want to crash everything
			// due to unhandler parsing errors.
			parser.on('error', () => {});
		}
	});

	// Expose start and stop handler
	const stop = () => new Promise((resolve) => {
		srv.close(resolve);
	});
	const start = () => {
		srv.bind(opts.bind);
		return stop;
	};
	return start;
};
