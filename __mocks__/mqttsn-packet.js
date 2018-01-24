const EE = require('events');

const parser = () => {
	const p = new EE();
	p.parse = jest.fn();
	module.exports._parser = p;
	return p;
};

module.exports = { parser };
