import { MCPOptionsSchema, MCPServerUserInputSchema, MCP_USER_INPUT_FIELDS } from './mcp';
it('operator MCP assessment validates read/write maps; untrusted server input never supplies it',()=>{
  const config={type:'streamable-http',url:'https://mcp.example.test',integrationEffects:{lookup:'read',mutate:'write'}};
  expect(MCPOptionsSchema.parse(config).integrationEffects).toEqual(config.integrationEffects);
  expect(MCPOptionsSchema.safeParse({...config,integrationEffects:{lookup:'maybe'}}).success).toBe(false);
  expect(MCPServerUserInputSchema.parse(config)).not.toHaveProperty('integrationEffects');
  expect(MCP_USER_INPUT_FIELDS.has('integrationEffects')).toBe(false);
});
