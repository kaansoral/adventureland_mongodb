var path=require("path"),f=require(path.resolve(__dirname, "script_functions.js"));
require(process.env.HOME+"/thegame/scripts/data.js");

for(var id in machines)
{
	var machine=machines[id];
	var command="ssh -o IdentitiesOnly=yes -p "+(machine.ssh_port||22)+" -i "+machine.key+" "+machine.user+"@"+machine.ip+" \"ps aux | grep node\"";
	console.log(command);
	f.execso(command);
}