export interface ClickableElementInfo {
  tag: string;
  text: string;
  ariaLabel: string;
  classes: string;
  id: string;
  role: string;
  jsname: string;
  jscontroller: string;
  jsaction: string;
  isVisible: boolean;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}
