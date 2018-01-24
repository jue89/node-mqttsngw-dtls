const EE = require('events');

const parser = () => {
	const p = new EE();
	p.parse = jest.fn();
	module.exports._parser = p;
	return p;
};

const generate = jest.fn(() => Buffer.alloc(0));

module.exports = { parser, generate };
