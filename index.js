const DTLS = require('openssl-dtls');

module.exports = (opts) => (bus) => new Promise((resolve) => {
	// Create new DTLS server context
	const srv = DTLS.createServer(opts);

	// Debug log incoming handshakes
	if (opts.log && opts.log.debug) {
		srv.on('connection', (peer) => opts.log.debug(
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

		// Debug log connection stuff
		if (opts.log && opts.log.debug) {
			opts.log.debug(`Handshake successfully finished with [${peer.address}]:${peer.port}`, {
				message_id: '1d223f68a881407d86b94babf40da157',
				clientKey: clientKey
			});
			socket.on('close', () => opts.log.debug(
				`Connection to [${peer.address}]:${peer.port} closed`,
				{
					message_id: '0664446f18574088b369460de3aa197b',
					clientKey: clientKey
				}
			));
		}
	});

	// Expose start and stop handler
	const stop = () => {
		// TODO
	};
	const start = () => {
		srv.bind(opts.bind);
		return stop;
	};
	resolve(start);
});
