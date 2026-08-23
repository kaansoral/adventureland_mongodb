// Backwards compatibility routines / functions

// Auto reload is default on now [28/02/19]
function auto_reload(value)
{
	// Configures the game to auto reload in case you disconnect due to rare network issues
	if(value===false) parent.auto_reload="off";
	else if(value=="auto") parent.auto_reload="auto"; // code or merchant stand
	else parent.auto_reload="on"; // always reload
}

function handle_death()
{
	// When a character dies, character.rip is true, you can override handle_death and manually respawn
	// IDEA: A Resident PVP-Dweller, with an evasive Code + irregular respawning
	// respawn current has a 12 second cooldown, best wait 15 seconds before respawning [24/11/16]
	// setTimeout(respawn,15000);
	// NOTE: Add `if(character.rip) {respawn(); return;}` to your main loop/interval too, just in case
}

function can_use(name)
{
	if(G.skills[name] && G.skills[name].class && !in_arr(character.ctype,G.skills[name].class)) return false; // checks the class
	return parent.can_use(name); // checks the cooldown
}

function use(name,target) // a multi-purpose use function, works for skills too
{
	if(isNaN(name)) // if name is not an integer, use the skill
	{
		if(!target) target=get_target();
		return parent.use_skill(name,target);
	}
	else
	{
		// for example, if there is a potion at the first inventory slot, use(0) would use it
		return equip(name);
	}
}

function on_cm(name,data)
{
	game_log("Received a code message from: "+name);
}

function on_combined_damage() // When multiple characters stay in the same spot, they receive combined damage, this function gets called whenever a monster deals combined damage
{
	// move(character.real_x+5,character.real_y);
}

function on_game_event(event)
{
	if(event.name=="pinkgoo")
	{
		// start searching for the "Love Goo" of the Valentine's Day event
	}
	if(event.name=="goblin")
	{
		// start searching for the "Sneaky Goblin"
	}
}

function in_attack_range(target) // also works for priests/heal
{
	if(!target) return false;
	if(parent.distance(character,target)<=character.range) return true;
	return false;
}

function is_pvp(){return in_pvp()}

function is_player(e){return is_character(e);}

function destroy_item(i){return destroy(i)}

character.on("stacked",function(){ on_combined_damage(); });
character.on("death",function(){ handle_death(); });
character.on("cm",function(data){ on_cm(data.name,data.message) });

// [06/03/19]: doneify aimed to add a completion callback to every function
// such as buy("shoes").done(function(success_flag,data){})
// feedback was mixed, ES6 Promise's were suggested, which hibernated the efforts
// currently shelving doneify, as current DOCS render functions directly, it won't work any more
// likely going to start returning Promise's and re-visit every routine 
function doneify(fn,s_event,f_event)
{
	return function(a,b,c,d,e,f){
		var context=this,args=arguments,rxd=randomStr(30),settled=false;
		var resolve_completion,reject_completion,success_listener,failure_listener;
		var completion=new Promise(function(resolve,reject){
			resolve_completion=resolve;
			reject_completion=reject;
		});
		function cleanup(){
			if(success_listener) game.remove(success_listener);
			if(failure_listener) game.remove(failure_listener);
			success_listener=failure_listener=null;
			if(parent.rxd==rxd) parent.rxd=null;
		}
		function finish(success,data){
			if(settled) return;
			settled=true;
			cleanup();
			if(success) resolve_completion(data);
			else reject_completion(data);
		}
		if(s_event)
		{
			var on_success=function(event){
				if(event && event.rxd==rxd)
				{
					on_success.delete=true;
					finish(true,event);
				}
			};
			success_listener=game.on(s_event,on_success);
		}
		if(f_event)
		{
			var on_failure=function(event){
				if(event && event.rxd==rxd)
				{
					on_failure.delete=true;
					finish(false,event);
				}
			};
			failure_listener=game.on(f_event,on_failure);
		}
		completion.done=function(callback){
			completion.then(function(data){callback(true,data)},function(data){callback(false,data)});
			return completion;
		};
		parent.rxd=rxd;
		try
		{
			var returned=fn.apply(context,args);
			if(returned && is_function(returned.then))
			{
				cleanup();
				returned.then(function(data){finish(true,data)},function(data){finish(false,data)});
			}
		}
		catch(error)
		{
			finish(false,error);
		}
		return completion;
	};
}
// buy=doneify(buy,"buy_success","buy_fail");
