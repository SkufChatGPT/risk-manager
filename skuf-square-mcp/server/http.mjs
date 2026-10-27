import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {hasPostingKey,publishSquareText} from './square.mjs';
const token=process.env.MCP_ACCESS_TOKEN;
if(!token || token.length<24) throw Error('Missing MCP_ACCESS_TOKEN');
console.info('BINANCE_SQUARE_OPENAPI_KEY_PRESENT=' + Boolean(process.env.BINANCE_SQUARE_OPENAPI_KEY?.trim()));
const tools=[
{name:'square_connection_status',description:'Check if Square API key is configured.',inputSchema:{type:'object',properties:{}}},
{name:'square_publish_text',description:'Publish only text explicitly approved by user.',inputSchema:{type:'object',properties:{text:{type:'string'},confirmation:{type:'string',enum:['ПУБЛИКУЙ']}},required:['text','confirmation']}}
];
const result=(id,r)=>({jsonrpc:'2.0',id,result:r});
function auth(h){if(!h?.startsWith('Bearer '))return false; const a=Buffer.from(h.slice(7)),b=Buffer.from(token);return a.length===b.length&&timingSafeEqual(a,b)}
function send(res,code,data){res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data))}
http.createServer(async(req,res)=>{
if(req.url==='/health')return send(res,200,{ok:true});
if(req.url!=='/mcp')return send(res,404,{error:'not found'});
if(!auth(req.headers.authorization))return send(res,401,{error:'unauthorized'});
if(req.method!=='POST')return send(res,405,{error:'use POST'});
try{
let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)return send(res,413,{error:'too large'})}
const q=JSON.parse(body),id=q.id;let r;
if(q.method==='initialize')r={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'skuf-square',version:'0.2.1'}};
else if(q.method==='tools/list')r={tools};
else if(q.method==='tools/call'){
let x;try{if(q.params.name==='square_connection_status')x={configured:hasPostingKey()};else if(q.params.name==='square_publish_text')x=await publishSquareText(q.params.arguments);else throw Error('Unknown tool');r={content:[{type:'text',text:JSON.stringify(x)}]}}catch(e){r={isError:true,content:[{type:'text',text:e.message}]}}
}else r={};
send(res,200,result(id,r))
}catch(e){send(res,400,{error:'invalid request'})}
}).listen(Number(process.env.PORT||3000),'0.0.0.0');
