const assert = require("node:assert/strict");
const vm = require("node:vm");
const { read, extract } = require("./server_vm");

function drag_runtime(source_data, target_data) {
	const nodes = new Map(),
		packets = [],
		deferred = [],
		dialogs = [];
	const source_parent = { html: "source" };
	const source = { id: "citem0", data: source_data, parent: source_parent };
	const target = { data: target_data, drop: true, html: "target" };
	nodes.set(source.id, source);
	// Empty jQuery collections remain truthy, including .parent() of an empty
	// collection. Keep that behavior here to catch an unbounded ancestor search.
	function $(node) {
		return {
			length: node ? 1 : 0,
			attr: (name) => (node && name === "ondrop" && node.drop ? "on_drop(event)" : undefined),
			data: (name) => node && node.data && node.data[name],
			parent: () => $(node && node.parent),
			closest(selector) {
				assert.equal(selector, "[ondrop]");
				let ancestor = node;
				while (ancestor && !ancestor.drop) ancestor = ancestor.parent;
				return $(ancestor);
			},
			html(value) {
				if (value === undefined) return node && node.html;
				if (node) node.html = value;
			},
			all_html: () => node && node.id,
			get: () => node,
			focus() {},
		};
	}
	const context = vm.createContext({
		$,
		console,
		document: { getElementById: (id) => nodes.get(id) },
		character: { items: [{ name: "sword" }, { name: "staff" }], slots: {} },
		G: { items: { sword: { type: "weapon" } } },
		socket: { emit: (name, args) => packets.push([name, JSON.parse(JSON.stringify(args))]) },
		push_deferred: (name) => deferred.push(name),
		cache_i: [],
		cache_slots: {},
		last_rendered_items: "items0",
		is_mobile: false,
		trade_slots: ["trade1"],
		in_arr: (value, array) => array.includes(value),
		render_item: (selector, args) => dialogs.push([selector, args]),
		xtarget: null,
		ctarget: null,
	});
	vm.runInContext(extract(read("js/html.js"), "on_drop"), context);
	function drop(id = source.id, onto = { parent: target }) {
		context.event = {
			target: onto,
			dataTransfer: {
				getData: (type) => {
					assert.equal(type, "text");
					return id;
				},
			},
			preventDefault() {},
			stopPropagation() {},
		};
		vm.runInContext("on_drop(event)", context, { timeout: 100 });
	}
	return { context, source, target, packets, deferred, dialogs, drop };
}

module.exports = { drag_runtime };
