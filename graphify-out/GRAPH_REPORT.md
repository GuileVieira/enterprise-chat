# Graph Report - packages/client  (2026-07-06)

## Corpus Check
- Corpus is ~47,742 words - fits in a single context window. You may not need a graph.

## Summary
- 810 nodes · 1319 edges · 110 communities (86 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Enums Menus Types|Enums Menus Types]]
- [[_COMMUNITY_Package Peer Dependencies|Package Peer Dependencies]]
- [[_COMMUNITY_Resizable Icon Components|Resizable Icon Components]]
- [[_COMMUNITY_Test Build Dependencies|Test Build Dependencies]]
- [[_COMMUNITY_Dialog Button Components|Dialog Button Components]]
- [[_COMMUNITY_Theme Selector State|Theme Selector State]]
- [[_COMMUNITY_Package Exports Config|Package Exports Config]]
- [[_COMMUNITY_Input Badge Components|Input Badge Components]]
- [[_COMMUNITY_CloudFront Image Cookies|CloudFront Image Cookies]]
- [[_COMMUNITY_TypeScript Compiler Config|TypeScript Compiler Config]]
- [[_COMMUNITY_Data Table Core|Data Table Core]]
- [[_COMMUNITY_Form Utility Components|Form Utility Components]]
- [[_COMMUNITY_Data Table Error Boundary|Data Table Error Boundary]]
- [[_COMMUNITY_Dropdown Menu Components|Dropdown Menu Components]]
- [[_COMMUNITY_Checkbox Table Components|Checkbox Table Components]]
- [[_COMMUNITY_Pixel Card Animation|Pixel Card Animation]]
- [[_COMMUNITY_Dynamic Theme System|Dynamic Theme System]]
- [[_COMMUNITY_Split Text Segmentation|Split Text Segmentation]]
- [[_COMMUNITY_Test TypeScript Config|Test TypeScript Config]]
- [[_COMMUNITY_Alert Dialog Components|Alert Dialog Components]]
- [[_COMMUNITY_Combobox Select Components|Combobox Select Components]]
- [[_COMMUNITY_Form Input Components|Form Input Components]]
- [[_COMMUNITY_Avatar Skeleton Hooks|Avatar Skeleton Hooks]]
- [[_COMMUNITY_Pagination Button Variants|Pagination Button Variants]]
- [[_COMMUNITY_Combobox Resize Tests|Combobox Resize Tests]]
- [[_COMMUNITY_Data Table Types|Data Table Types]]
- [[_COMMUNITY_Old Theme Context|Old Theme Context]]
- [[_COMMUNITY_Breadcrumb Components|Breadcrumb Components]]
- [[_COMMUNITY_Data Table Hooks|Data Table Hooks]]
- [[_COMMUNITY_Animated Tabs Component|Animated Tabs Component]]
- [[_COMMUNITY_Multi Select Component|Multi Select Component]]
- [[_COMMUNITY_Jest Browser Mocks|Jest Browser Mocks]]
- [[_COMMUNITY_Data Table Tests|Data Table Tests]]
- [[_COMMUNITY_Hover Info Cards|Hover Info Cards]]
- [[_COMMUNITY_Input OTP Components|Input OTP Components]]
- [[_COMMUNITY_Tailwind Color Config|Tailwind Color Config]]
- [[_COMMUNITY_Accordion Components|Accordion Components]]
- [[_COMMUNITY_Switch Components|Switch Components]]
- [[_COMMUNITY_Tabs Components|Tabs Components]]
- [[_COMMUNITY_Tag Components|Tag Components]]
- [[_COMMUNITY_Tooltip Components|Tooltip Components]]
- [[_COMMUNITY_File Upload Component|File Upload Component]]
- [[_COMMUNITY_Filter Input Component|Filter Input Component]]
- [[_COMMUNITY_Secret Input Component|Secret Input Component]]
- [[_COMMUNITY_Slider Component|Slider Component]]
- [[_COMMUNITY_Textarea Component|Textarea Component]]
- [[_COMMUNITY_Edit Icon|Edit Icon]]
- [[_COMMUNITY_Gear Icon|Gear Icon]]
- [[_COMMUNITY_Save Icon|Save Icon]]
- [[_COMMUNITY_Speech Icon|Speech Icon]]
- [[_COMMUNITY_Switch Icon|Switch Icon]]
- [[_COMMUNITY_Question Mark Icon|Question Mark Icon]]
- [[_COMMUNITY_BedrockIcon Component|BedrockIcon Component]]
- [[_COMMUNITY_Blocks Code|Blocks Code]]
- [[_COMMUNITY_CheckMark Code|CheckMark Code]]
- [[_COMMUNITY_Clipboard Code|Clipboard Code]]
- [[_COMMUNITY_GoogleIconChat Code|GoogleIconChat Code]]
- [[_COMMUNITY_LightningIcon Component|LightningIcon Component]]
- [[_COMMUNITY_PaLMinimalIcon Component|PaLMinimalIcon Component]]
- [[_COMMUNITY_Plugin Code|Plugin Code]]
- [[_COMMUNITY_VolumeMuteIcon Component|VolumeMuteIcon Component]]
- [[_COMMUNITY_Dynamic Column Widths|Dynamic Column Widths]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 161 edges
2. `compilerOptions` - 20 edges
3. `useLocalize()` - 16 edges
4. `installCloudFrontImageRetry()` - 9 edges
5. `scripts` - 8 edges
6. `Pixel` - 8 edges
7. `IThemeRGB` - 8 edges
8. `compilerOptions` - 8 edges
9. `OptionWithIcon` - 7 edges
10. `DataTableErrorBoundaryInner` - 7 edges

## Surprising Connections (you probably didn't know these)
- `AlertDialogPortal()` --calls--> `cn()`  [EXTRACTED]
  src/components/AlertDialog.tsx → src/utils/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/AlertDialog.tsx → src/utils/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/AlertDialog.tsx → src/utils/utils.ts
- `AnimatedTabs()` --calls--> `cn()`  [EXTRACTED]
  src/components/AnimatedTabs.tsx → src/utils/utils.ts
- `Badge()` --calls--> `cn()`  [EXTRACTED]
  src/components/Badge.tsx → src/utils/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Dynamic Theme Three Layer Architecture** — packages_client_src_theme_readme_css_variables_layer, packages_client_src_theme_readme_themeprovider, packages_client_src_theme_readme_tailwind_layer [EXTRACTED 1.00]

## Communities (110 total, 24 thin omitted)

### Community 0 - "Enums Menus Types"
Cohesion: 0.05
Nodes (38): ESide, NotificationSeverity, MenuItemProps, RenderProp, DropdownValueSetter, MentionOption, Option, OptionWithIcon (+30 more)

### Community 1 - "Package Peer Dependencies"
Cohesion: 0.04
Nodes (46): peerDependencies, @ariakit/react, @ariakit/react-core, class-variance-authority, clsx, @dicebear/collection, @dicebear/core, dompurify (+38 more)

### Community 2 - "Resizable Icon Components"
Cohesion: 0.08
Nodes (20): ResizableHandle(), ResizableHandleAlt(), ResizablePanelGroup(), AnthropicIcon(), AssistantIcon(), AzureMinimalIcon(), BirthdayIcon(), CircleHelpIcon() (+12 more)

### Community 3 - "Test Build Dependencies"
Cohesion: 0.06
Nodes (36): devDependencies, @babel/core, babel-jest, @babel/preset-env, @babel/preset-react, @babel/preset-typescript, caniuse-lite, concat-with-sourcemaps (+28 more)

### Community 4 - "Dialog Button Components"
Cohesion: 0.07
Nodes (29): Button, ButtonProps, DialogButton, DialogClose, DialogContent, DialogContentProps, DialogDescription, DialogFooter() (+21 more)

### Community 5 - "Theme Selector State"
Cohesion: 0.12
Nodes (26): Theme(), ThemeSelector(), ThemeType, Window, themeColorsAtom, themeModeAtom, themeNameAtom, getInitialTheme() (+18 more)

### Community 6 - "Package Exports Config"
Cohesion: 0.08
Nodes (24): description, exports, files, import, main, module, name, repository (+16 more)

### Community 7 - "Input Badge Components"
Cohesion: 0.08
Nodes (13): Badge(), BadgeProps, CheckboxButton, InputNumber, Progress, Separator, ContinueIcon(), ListeningIcon() (+5 more)

### Community 8 - "CloudFront Image Cookies"
Cohesion: 0.15
Nodes (21): CloudFrontCookieRefreshConfig, CloudFrontCookieRefreshOptions, CloudFrontCookieRefreshResponse, configureCloudFrontCookieRefresh(), dispatchImageError(), forwardedImageErrors, getBaseUrl(), getRefreshConfig() (+13 more)

### Community 9 - "TypeScript Compiler Config"
Cohesion: 0.08
Nodes (23): compilerOptions, allowSyntheticDefaultImports, declaration, declarationDir, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, jsx (+15 more)

### Community 10 - "Data Table Core"
Cohesion: 0.15
Nodes (19): DataTableProps, DeleteButton, getColumnStyle(), MemoizedTableRow, SelectionCheckbox, TableColumn, TableRowComponent(), DataTable() (+11 more)

### Community 11 - "Form Utility Components"
Cohesion: 0.13
Nodes (11): AnimatedSearchInput(), DelayedRender(), DelayedRenderProps, Option, Radio, RadioProps, useDelayedRender(), TranslationKeys (+3 more)

### Community 12 - "Data Table Error Boundary"
Cohesion: 0.14
Nodes (9): DataTableErrorBoundary(), DataTableErrorBoundaryInner, DataTableErrorBoundaryInnerProps, DataTableErrorBoundaryProps, DataTableErrorBoundaryState, createLogFunction(), LogFunction, logger (+1 more)

### Community 13 - "Dropdown Menu Components"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 14 - "Checkbox Table Components"
Cohesion: 0.16
Nodes (12): BaseCheckboxProps, Checkbox, CheckboxProps, ForwardTableRowComponent, ForwardTableRowComponentType, GenericRowProps, MemoizedTableRow, SelectionCheckbox (+4 more)

### Community 15 - "Pixel Card Animation"
Cohesion: 0.24
Nodes (6): clamp(), getEffectiveSpeed(), Pixel, PixelCard(), PixelCardProps, VARIANTS

### Community 16 - "Dynamic Theme System"
Cohesion: 0.15
Nodes (13): CSS Variables Layer, Dark/Light Mode, Dynamic Color Theming, Dynamic Theme System, Environment Variable Themes, IThemeRGB, localStorage Persistence, RGB Format Requirements (+5 more)

### Community 17 - "Split Text Segmentation"
Cohesion: 0.18
Nodes (9): Intl, IntlSegmenter, IntlSegmenterConstructor, SegmentData, SegmenterOptions, Segments, splitGraphemes(), SplitText() (+1 more)

### Community 19 - "Test TypeScript Config"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, declarationDir, declarationMap, noEmit, outDir, rootDir, types (+3 more)

### Community 20 - "Alert Dialog Components"
Cohesion: 0.18
Nodes (10): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogPortal() (+2 more)

### Community 21 - "Combobox Select Components"
Cohesion: 0.24
Nodes (9): ComboboxComponent(), SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger (+1 more)

### Community 22 - "Form Input Components"
Cohesion: 0.29
Nodes (6): FormInput(), Input, InputProps, InputWithDropdown, InputWithDropdownProps, Label

### Community 23 - "Avatar Skeleton Hooks"
Cohesion: 0.24
Nodes (6): Avatar(), AvatarProps, Skeleton(), avatarCache, useAvatar(), UserIcon()

### Community 24 - "Pagination Button Variants"
Cohesion: 0.22
Nodes (9): buttonVariants, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 25 - "Combobox Resize Tests"
Cohesion: 0.20
Nodes (4): CapturedObserver, CapturingResizeObserver, items, observers

### Community 26 - "Data Table Types"
Cohesion: 0.24
Nodes (6): DataTableConfig, DataTableProps, DataTableSearchProps, ProcessedDataRow, TableColumnDef, DataTableSearch

### Community 27 - "Old Theme Context"
Cohesion: 0.29
Nodes (8): defaultContextValue, isDark(), ProviderValue, ThemeContext, ThemeProvider(), fontSizeAtom, applyFontSize(), getInitialTheme()

### Community 28 - "Breadcrumb Components"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 29 - "Data Table Hooks"
Cohesion: 0.46
Nodes (6): DataTable(), useColumnStyles(), useDebounced(), useKeyboardNavigation(), useOptimizedRowSelection(), TableColumn

### Community 30 - "Animated Tabs Component"
Cohesion: 0.29
Nodes (5): AnimatedTabs(), AnimatedTabsProps, Tab, TabItem, TabPanel

### Community 31 - "Multi Select Component"
Cohesion: 0.48
Nodes (6): defaultRender(), getItemLabel(), getItemValue(), MultiSelect(), MultiSelectItem, MultiSelectProps

### Community 35 - "Input OTP Components"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 36 - "Tailwind Color Config"
Cohesion: 0.60
Nodes (3): createTailwindColors(), withOpacity(), { createTailwindColors }

### Community 37 - "Accordion Components"
Cohesion: 0.50
Nodes (3): AccordionContent, AccordionItem, AccordionTrigger

### Community 38 - "Switch Components"
Cohesion: 0.50
Nodes (3): BaseSwitchProps, Switch, SwitchProps

### Community 39 - "Tabs Components"
Cohesion: 0.50
Nodes (3): TabsContent, TabsList, TabsTrigger

### Community 40 - "Tag Components"
Cohesion: 0.50
Nodes (3): Tag, TagPrimitiveRoot, TagProps

### Community 41 - "Tooltip Components"
Cohesion: 0.67
Nodes (3): TooltipAnchor, TooltipAnchorProps, TooltipPopup

## Knowledge Gaps
- **295 isolated node(s):** `name`, `version`, `description`, `type`, `url` (+290 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Resizable Icon Components` to `Enums Menus Types`, `Dialog Button Components`, `Input Badge Components`, `Data Table Core`, `Form Utility Components`, `Dropdown Menu Components`, `Checkbox Table Components`, `Pixel Card Animation`, `Alert Dialog Components`, `Combobox Select Components`, `Form Input Components`, `Avatar Skeleton Hooks`, `Pagination Button Variants`, `Data Table Types`, `Breadcrumb Components`, `Data Table Hooks`, `Animated Tabs Component`, `Multi Select Component`, `Hover Info Cards`, `Input OTP Components`, `Accordion Components`, `Switch Components`, `Tabs Components`, `Tag Components`, `Tooltip Components`, `Filter Input Component`, `Secret Input Component`, `Slider Component`, `Textarea Component`, `Edit Icon`, `Speech Icon`, `Question Mark Icon`, `BedrockIcon Component`, `Blocks Code`, `CheckMark Code`, `Clipboard Code`, `GoogleIconChat Code`, `LightningIcon Component`, `PaLMinimalIcon Component`, `Plugin Code`, `VolumeMuteIcon Component`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `peerDependencies` connect `Package Peer Dependencies` to `Package Exports Config`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `useLocalize()` connect `Form Utility Components` to `Dialog Button Components`, `Theme Selector State`, `Data Table Core`, `Data Table Error Boundary`, `Data Table Types`, `Data Table Hooks`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Enums Menus Types` be split into smaller, more focused modules?**
  _Cohesion score 0.05367231638418079 - nodes in this community are weakly interconnected._
- **Should `Package Peer Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Resizable Icon Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08258258258258258 - nodes in this community are weakly interconnected._