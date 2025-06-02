import { Item } from './items';
import { Pages } from './pages';
import { PageIntegration } from './pageintegrations';
import { ItemIntegration } from './itemintegrations';
import { TeamScavHunts } from './teamscavhunts';
import { TeamIntegration } from './teamintegrations';
import { Teams } from './teams';
import { ScavHunts } from './scavhunts';
import { ListCategories } from './listcategories';

Pages.hasOne(PageIntegration);
PageIntegration.belongsTo(Pages)
ItemIntegration.belongsTo(Item);
Item.hasOne(ItemIntegration);

export {Item, Pages, PageIntegration, ItemIntegration, TeamScavHunts, Teams, TeamIntegration, ScavHunts, ListCategories}
