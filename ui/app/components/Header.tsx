import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/" />
        <AppHeader.NavItem as={Link} to="/">
          Dashboard
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/explorer">
          VI Explorer
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/health">
          Production Health
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
