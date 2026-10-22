import {operate} from './operate.mjs';try{await operate('setup',{supervisor:true})}catch(e){console.error('SUPERVISOR_HOLD',e.message);process.exitCode=1}
