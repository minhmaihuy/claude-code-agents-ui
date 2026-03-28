Implement the following plan:                                                                            
                                                                                                           
  # Claude Code Chat Configuration Features Plan                                                           
                                                                                                           
  ## Overview                                                                                              
  Add 4 key configuration features to the Chat v2 interface:                                               
  1. **Mode Selection** (Thinking mode for deeper reasoning)                                               
  2. **Model Type Selection** (Opus/Sonnet/Haiku)                                                          
  3. **Permission Mode Options** (Ask/Skip/Accept Edits/Plan/Dangerous)                                    
  4. **Image Attachments** (UI for attaching images to messages)                                           
                                                                                                           
  ---                                                                                                      
                                                                                                           
  ## Critical Files to Modify                                                                              
                                                                                                           
  ### Backend Investigation Needed                                                                         
  - `server/utils/providers/claudeProvider.ts` - SDK query options                                         
  - `server/utils/claudeSdk.ts` - Query function parameters                                                
  - `server/api/v2/chat/ws.ts` - V2 WebSocket handler                                                      
                                                                                                           
  ### Frontend Files                                                                                       
  - `app/components/cli/chatv2/ChatV2Interface.vue` - Add model/thinking dropdowns in header               
  - `app/composables/useChatV2Handler.ts` - Pass config options to sendChat                                
  - `app/components/cli/chatv2/ChatV2Input.vue` - Add image attachment button/file picker                  
  - `app/components/cli/chatv2/ChatV2MessageItem.vue` - Render image previews in user messages             
  - `app/types/index.ts` - Update PermissionMode type values                                               
                                                                                                           
  ---                                                                                                      
                                                                                                           
  ## Implementation Approach                                                                               
                                                                                                           
  ### Phase 1: Model Type Selection (Opus/Sonnet/Haiku)                                                    
  **Goal**: Dropdown in header to select model per-session                                                 
                                                                                                           
  **Implementation**:                                                                                      
  - Add model selector in header as a compact dropdown or segmented control                                
  - Options: Opus, Sonnet, Haiku                                                                           
  - Bind similar to existing `selectedPermissionMode` pattern                                              
  - Pass `model` option to `sendChat()` in useChatV2Handler                                                
  - Display selected model inline in header                                                                
                                                                                                           
  ### Phase 2: Thinking Mode Toggle                                                                        
  **Goal**: Checkbox/toggle for "Thinking" mode enabling deeper reasoning                                  
                                                                                                           
  **Implementation**:                                                                                      
  - Add thinking mode toggle (checkbox or switch) next to model selector                                   
  - When enabled, passes thinking capability to the selected model                                         
  - Need to investigate SDK support for this parameter                                                     
                                                                                                           
  **Note**: Will check if `@anthropic-ai/claude-agent-sdk` supports a thinking mode parameter during       
  implementation. If not available, will add visual indicator that it's "coming soon" or use system        
  prompt workaround.                                                                                       
                                                                                                           
  ### Phase 3: Permission Mode Options                                                                     
  **Goal**: Refine permission modes based on Claude Code's actual behavior                                 
                                                                                                           
  **Permission Modes** (update `ChatV2PermissionModeSelector.vue`):                                        
  | Value | Label | Description |                                                                          
  |-------|-------|-------------|                                                                          
  | `default` | Ask | Ask for permission on each action |                                                  
  | `skip` | Skip | Allow all actions for this session (session-only bypass) |                             
  | `acceptEdits` | Accept Edits | Auto-approve file edits |                                               
  | `plan` | Plan Mode | Plan only, no execution |                                                         
  | `bypassPermissions` | Dangerous | Full bypass - dangerous mode |                                       
                                                                                                           
  **Implementation**:                                                                                      
  - Keep existing modes, just ensure `skip` is available                                                   
  - Update labels to be clearer                                                                            
  - Place compact dropdown in header bar next to model selector                                            
                                                                                                           
  ### Phase 4: Image Attachments                                                                           
  **Goal**: File picker and preview for image uploads                                                      
                                                                                                           
  **Implementation**:                                                                                      
  - Add "Attach Image" button (paperclip icon) in ChatV2Input.vue                                          
  - Hidden file input accepting `image/*`                                                                  
  - Client-side base64 encoding using FileReader                                                           
  - Thumbnail preview strip above input (with remove button per image)                                     
  - Pass `images: string[]` array to `sendChat()`                                                          
  - Update `ChatV2MessageItem.vue` to render `<img>` tags for user message images                          
                                                                                                           
  ---                                                                                                      
                                                                                                           
  ## UI Layout (Header Bar)                                                                                
                                                                                                           
  Compact layout placing controls side-by-side:                                                            
                                                                                                           
  ```                                                                                                      
  ┌─────────────────────────────────────────────────────────────────────┐                                  
  │ Session Info        [Model▼]  ☑Thinking  [Permissions▼]  [Status]  │                                   
  ├─────────────────────────────────────────────────────────────────────┤                                  
  │ ┌── Messages ────────────────────────────────────────────────────┐ │                                   
  │                                                                  │ │                                   
  │  [🖼️ 🖼️]  ← image thumbnails                                     │ │                                   
  │ ┌──────────────────────────────────────────────────┐             │ │                                   
  │ │ Message text here...                        [📎] │             │ │                                   
  │ └──────────────────────────────────────────────────┘             │ │                                   
  └──────────────────────────────────────────────────────────────────┘                                     
  ```                                                                                                      
                                                                                                           
  Alternative (popovers instead of dropdowns for more space):                                              
  - Clicking "Model" opens popover with radio buttons for Opus/Sonnet/Haiku                                
  - Clicking "Permissions" opens popover with mode options and descriptions                                
                                                                                                           
  ---                                                                                                      
                                                                                                           
  ## Verification Steps                                                                                    
                                                                                                           
  1. **Model Selection**: Change model → send message → verify backend receives model param                
  2. **Thinking Mode**: Enable thinking → send message → verify request includes thinking flag             
  3. **Permission Modes**: Test each mode triggers expected permission behavior                            
  4. **Image Attachment**:                                                                                 
  - Click attach button → select image → see thumbnail                                                     
  - Remove image → thumbnail disappears                                                                    
  - Send message → image appears in chat history                                                           
  - Verify image data sent to backend as base64                                                            
                                                                                                           
  ---                                                                                                      
                                                                                                           
  ## Implementation Notes                                                                                  
                                                                                                           
  **Skipping questions** - The following are clarified by user feedback:                                   
  - Thinking mode = special mode for same model (not different model)                                      
  - Skip permission = allow all for this session (distinct from "Dangerous")                               
  - UI layout = model and permission dropdowns side-by-side in header                                      
                                                                                                           
  Ready to proceed with implementation. 